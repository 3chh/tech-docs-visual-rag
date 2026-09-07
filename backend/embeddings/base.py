"""Lớp cơ sở cho các embedding manager theo kiến trúc ColPali (multi-vector)."""

from abc import ABC
from typing import List

import torch
from PIL import Image

from ..core.logging import get_logger

logger = get_logger(__name__)


class BaseEmbeddingManager(ABC):
    """Đăng ký các manager con vào registry để chọn động theo config.

    Nạp model và dựng processor tách làm hai bước vì chúng có vòng đời khác
    nhau: weights nặng vài GB VRAM và chỉ phụ thuộc `model_name`, còn
    processor rẻ và phụ thuộc `max_num_visual_tokens`/`min_width` của từng bộ
    tài liệu. Nhờ tách ra, nhiều bộ với tham số resize khác nhau vẫn dùng
    chung một model.
    """

    registry: dict[str, type["BaseEmbeddingManager"]] = {}

    #: Lớp model và processor của colpali-engine.
    model_cls = None
    processor_cls = None
    #: Model này nhận attn_implementation khi nạp hay không.
    accepts_attn_impl = True
    #: Chỉ LongColQwen hiểu min_width (ghim chiều rộng, chiều cao tự do).
    supports_min_width = False

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if cls.__name__ != "BaseEmbeddingManager":
            cls.registry[cls.__name__.lower()] = cls

    def __init__(
        self,
        device: str = "cuda",
        model_name: str = "",
        max_num_visual_tokens: int | None = None,
        min_width: int | None = None,
        model=None,
    ):
        self.device = device
        self.model_name = model_name
        # `model` cho phép chia sẻ weights đã nạp giữa các manager khác
        # processor. Xem embeddings/__init__.py.
        self.model = model if model is not None else self.load_model(device, model_name)
        self.processor = self.build_processor(model_name, max_num_visual_tokens, min_width)

    @classmethod
    def load_model(cls, device: str, model_name: str):
        kwargs = {"torch_dtype": torch.bfloat16, "device_map": device}

        if cls.accepts_attn_impl:
            from transformers.utils.import_utils import is_flash_attn_2_available

            kwargs["attn_implementation"] = (
                "flash_attention_2" if is_flash_attn_2_available() else None
            )

        logger.info(
            "Nạp %s | model=%s device=%s attn=%s",
            cls.__name__,
            model_name,
            device,
            kwargs.get("attn_implementation"),
        )
        return cls.model_cls.from_pretrained(model_name, **kwargs).eval()

    @classmethod
    def build_processor(
        cls,
        model_name: str,
        max_num_visual_tokens: int | None = None,
        min_width: int | None = None,
    ):
        """Dựng processor mới. Rẻ: chỉ là cấu hình resize và tokenizer.

        Truyền qua `from_pretrained` chứ không sửa thuộc tính sau khi tạo —
        `max_num_visual_tokens` được colpali-engine dịch sang nhiều trường
        bên trong image_processor, tự đoán trường nào là sai.
        """
        kwargs = {}
        if max_num_visual_tokens is not None:
            kwargs["max_num_visual_tokens"] = max_num_visual_tokens
        if min_width is not None and cls.supports_min_width:
            kwargs["min_width"] = min_width

        return cls.processor_cls.from_pretrained(model_name, **kwargs)

    def get_images(self, paths: list[str]) -> List[Image.Image]:
        return [Image.open(path) for path in paths]

    def process_images(
        self,
        image_paths: list[str],
        type: str = "qdrant-standalone",
        batch_size: int = None,
        max_token: int = None,
    ):
        """Embed danh sách ảnh thành multi-vector.

        Với Qdrant trả thêm rds/cds — vector pooled theo hàng/cột dùng cho
        tầng prefetch có index; `original` chỉ dùng để rerank.
        """
        logger.info("Processing %d image_paths", len(image_paths))
        images = self.get_images(image_paths)

        is_qdrant = type == "qdrant-standalone"
        ds_np = []
        rds = [] if is_qdrant else None
        cds = [] if is_qdrant else None

        if max_token is not None:
            logger.info("Using dynamic batching with max_token=%d", max_token)
            image_sizes = [img.size[::-1] for img in images]  # PIL (w,h) -> (h,w)
            token_info = self.processor._get_num_multimodal_tokens(image_sizes=image_sizes)
            token_counts = (
                token_info.num_image_tokens
                if hasattr(token_info, "num_image_tokens")
                else token_info["num_image_tokens"]
            )

            max_batch_size = batch_size if (batch_size is not None and batch_size > 0) else None

            # Sort theo số token để giảm padding trong mỗi batch.
            indexed = list(range(len(images)))
            indexed.sort(key=lambda i: token_counts[i])

            # Preallocate slot để khôi phục thứ tự gốc sau khi chạy xong.
            ds_slots = [None] * len(images)
            r_slots = [None] * len(images) if is_qdrant else None
            c_slots = [None] * len(images) if is_qdrant else None

            def _run_batch(batch_items):
                idxs = [it[0] for it in batch_items]
                batch_imgs = [it[1] for it in batch_items]

                batch_doc = self.processor.process_images(batch_imgs)
                with torch.no_grad():
                    batch_doc_device = {
                        k: v.to(self.model.device, non_blocking=True) for k, v in batch_doc.items()
                    }
                    embeddings_doc = self.model(**batch_doc_device)

                for idx, (d, processed_image, img0) in enumerate(
                    zip(torch.unbind(embeddings_doc), batch_doc.input_ids, batch_imgs)
                ):
                    original_i = idxs[idx]
                    if is_qdrant:
                        rd_full, cd_full = self._pool_image_tokens(d, processed_image, img0)
                        r_slots[original_i] = rd_full.detach().cpu().float().numpy().tolist()
                        c_slots[original_i] = cd_full.detach().cpu().float().numpy().tolist()

                    ds_slots[original_i] = d.detach().to("cpu", dtype=torch.float32).numpy()

                del embeddings_doc, batch_doc_device

            batch_items = []
            current_max_tokens = 0

            for i in indexed:
                img = images[i]
                tokens = token_counts[i]

                next_B = len(batch_items) + 1
                next_max_tokens = max(current_max_tokens, tokens)

                exceeds_batch_cap = max_batch_size is not None and next_B > max_batch_size
                exceeds_token_budget = next_B * next_max_tokens > max_token

                if (exceeds_batch_cap or exceeds_token_budget) and batch_items:
                    _run_batch(batch_items)
                    batch_items = []
                    current_max_tokens = 0
                    next_B = 1
                    next_max_tokens = tokens

                # Ảnh đơn lẻ vượt ngân sách thì chạy riêng một mình.
                if not batch_items and tokens > max_token:
                    _run_batch([(i, img, tokens)])
                    continue

                batch_items.append((i, img, tokens))
                current_max_tokens = next_max_tokens

            if batch_items:
                _run_batch(batch_items)

            ds_np = ds_slots
            if is_qdrant:
                rds = r_slots
                cds = c_slots
        else:
            if batch_size is None or batch_size < 1:
                batch_size = 1
            for i in range(0, len(images), batch_size):
                batch_imgs = images[i : i + batch_size]
                batch_doc = self.processor.process_images(batch_imgs)
                with torch.no_grad():
                    batch_doc_device = {
                        k: v.to(self.model.device, non_blocking=True) for k, v in batch_doc.items()
                    }
                    embeddings_doc = self.model(**batch_doc_device)

                for d, processed_image, img0 in zip(
                    torch.unbind(embeddings_doc), batch_doc.input_ids, batch_imgs
                ):
                    if is_qdrant:
                        rd_full, cd_full = self._pool_image_tokens(d, processed_image, img0)
                        rds.append(rd_full.detach().cpu().float().numpy().tolist())
                        cds.append(cd_full.detach().cpu().float().numpy().tolist())

                    ds_np.append(d.detach().to("cpu", dtype=torch.float32).numpy())

                del embeddings_doc, batch_doc_device

        for img in images:
            try:
                img.close()
            except Exception:
                pass

        if type in ("milvus-lite", "milvus-standalone"):
            return ds_np
        if type == "qdrant-standalone":
            return ds_np, rds, cds
        raise ValueError(f"Unsupported database type: {type}")

    def _pool_image_tokens(self, d, processed_image, img0):
        """Pool token ảnh theo hàng và cột, giữ nguyên prefix/postfix token của prompt.

        Hai vector này được đánh index HNSW để prefetch; `original` thì không.
        """
        x_patches, y_patches = self.processor.get_n_patches(img0.size, self.model.spatial_merge_size)
        image_tokens_mask = processed_image.to(d.device) == self.processor.image_token_id
        image_tokens = d[image_tokens_mask].view(x_patches, y_patches, self.model.dim)
        rd = torch.mean(image_tokens, dim=0)
        cd = torch.mean(image_tokens, dim=1)

        image_token_idxs = torch.nonzero(image_tokens_mask.int(), as_tuple=False)
        first_image_token_idx = image_token_idxs[0].item()
        last_image_token_idx = image_token_idxs[-1].item()

        prefix_tokens = d[:first_image_token_idx]
        postfix_tokens = d[last_image_token_idx + 1 :]

        rd_full = torch.cat((prefix_tokens, rd, postfix_tokens), dim=0)
        cd_full = torch.cat((prefix_tokens, cd, postfix_tokens), dim=0)
        return rd_full, cd_full

    def process_text(self, texts: list[str]):
        with torch.no_grad():
            processed_queries = self.processor.process_queries(texts).to(self.model.device)
            query_embeddings_batch = self.model(**processed_queries)
        return query_embeddings_batch.cpu().float().numpy()
