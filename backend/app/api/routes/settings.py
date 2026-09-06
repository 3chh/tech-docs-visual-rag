"""Endpoint phơi cấu hình hiện tại cho UI.

Chỉ đọc. Secret không bao giờ trả ra, chỉ trả cờ đã cấu hình hay chưa.
"""


from fastapi import APIRouter

from ....core.config import get_settings
from ....core.logging import get_logger
from ....core.providers import has_usable_connection
from ....document.llm_report_valid import MIN_SECTION_HEIGHT_PX
from ....vectordb.qdrant_manager import UPSERT_BATCH_SIZE
from ...schemas.settings import (
    ChunkingSettings,
    DocumentSettings,
    EmbeddingSettingsOut,
    IndexingSettings,
    LayoutSettings,
    ModelEndpoint,
    ModelsSettings,
    OcrSettings,
    PdfToImageSettings,
    PreprocessSettings,
    RuntimeSettings,
    SettingsResponse,
    TocValidatorSettings,
    VectorDbSettings,
)
from ...services.rag import TOC_PREVIEW_LIMIT

logger = get_logger(__name__)
router = APIRouter(tags=["settings"])

# Khớp với ràng buộc của AskRequest.top_k
TOP_K_MIN = 1
TOP_K_MAX = 20
TOP_K_DEFAULT = 5


@router.get("/settings", response_model=SettingsResponse)
async def read_settings() -> SettingsResponse:
    s = get_settings()
    doc = s.document
    pre = doc.preprocess_pdf
    emb = s.embedding
    db = s.database

    return SettingsResponse(
        runtime=RuntimeSettings(
            top_k_default=TOP_K_DEFAULT,
            top_k_min=TOP_K_MIN,
            top_k_max=TOP_K_MAX,
            use_toc_rewrite_default=True,
            toc_preview_limit=TOC_PREVIEW_LIMIT,
        ),
        document=DocumentSettings(
            worker_endpoint=doc.worker_endpoint,
            preprocess=PreprocessSettings(
                cut_params=pre.cut_params,
                padding=pre.padding,
                batch_size=pre.batch_size,
                text_model=pre.text_model,
                use_cut_padding=pre.use_cut_padding,
                pdf_to_image=PdfToImageSettings(
                    dpi=pre.pdf_to_image.dpi,
                    min_dpi=pre.pdf_to_image.min_dpi,
                    anchor_size=pre.pdf_to_image.anchor_size,
                    thread_count=pre.pdf_to_image.thread_count,
                    vertical_split=pre.pdf_to_image.vertical_split,
                ),
            ),
            layout=LayoutSettings(
                model_name=doc.element_detector.model_name,
                batch_size=doc.element_detector.batch_size,
            ),
            ocr=OcrSettings(
                number_batch_size=doc.summary_reporter.number_batch_size,
                title_batch_size=doc.summary_reporter.title_batch_size,
                formula_batch_size=doc.summary_reporter.formula_batch_size,
                lazy_load=doc.summary_reporter.lazy_load,
            ),
            chunking=ChunkingSettings(
                cut_padding=doc.section_merger.cut_padding,
                remove_page_number=doc.section_merger.remove_page_number,
                keep_chunk_pages=doc.section_merger.keep_chunk_pages,
                min_section_height_px=MIN_SECTION_HEIGHT_PX,
            ),
            toc_validator=TocValidatorSettings(
                type=doc.llm_validator.type,
                model_name=doc.llm_validator.model_name,
                endpoint=doc.llm_validator.endpoint,
                temperature=doc.llm_validator.temperature,
                api_key_configured=bool(doc.llm_validator.api_key),
            ),
        ),
        indexing=IndexingSettings(
            embedding=EmbeddingSettingsOut(
                type=emb.type,
                model_name=emb.model_name,
                device=emb.device,
                dim=emb.dim,
                max_num_visual_tokens=emb.max_num_visual_tokens,
                min_width=emb.min_width,
                batching_mode=emb.batching_mode,
                batch_size=emb.batch_size,
                max_token=emb.max_token,
                prefix_num_tokens=emb.prefix_num_tokens,
                doc_dim=emb.doc_dim,
            ),
            vectordb=VectorDbSettings(
                type=db.type,
                uri=db.uri,
                grpc_port=db.grpc_port,
                database_name=db.database_name,
                collection_name=db.collection_name,
                search_limit=db.search_limit,
                upsert_batch_size=UPSERT_BATCH_SIZE,
            ),
        ),
        models=ModelsSettings(
            vlm=ModelEndpoint(
                type=s.vlm.type,
                endpoint=s.vlm.endpoint,
                model_name=s.vlm.model_name,
                api_key_configured=has_usable_connection("vlm"),
            ),
            llm=ModelEndpoint(
                type=s.llm.type,
                endpoint=s.llm.endpoint,
                model_name=s.llm.model_name,
                api_key_configured=has_usable_connection("llm"),
            ),
        ),
        data_dir=str(s.paths.data_dir),
        metadata_dir=str(s.paths.metadata_dir),
        log_level=s.log_level,
    )
