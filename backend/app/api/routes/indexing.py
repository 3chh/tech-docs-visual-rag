"""Endpoint index tài liệu PDF."""

import json
import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ....core.logging import get_logger
from ...schemas import (
    CollectionListResponse,
    IndexRequest,
    IndexResponse,
    UploadFilesResponse,
)
from ...services.indexing import IndexingService
from ...services.retrieval import RetrievalService
from ...services.toc import generate_and_save

logger = get_logger(__name__)
router = APIRouter(tags=["indexing"])


@router.post("/index", response_model=IndexResponse)
async def index_document(request: IndexRequest) -> IndexResponse:
    """Index một PDF đã có sẵn trên đĩa của server."""
    logger.info("Index | user=%s pdf=%s", request.user_id, request.pdf_path)
    try:
        service = IndexingService(request.user_id, create_collection=True)
        image_paths = service.index(
            pdf_path=request.pdf_path,
            media_dir=request.media_dir,
            max_pages=request.max_pages,
            custom_config=request.custom_config,
            metadata=request.metadata,
        )
        return IndexResponse(pages_indexed=len(image_paths), status="completed")
    except Exception as e:
        logger.exception("Index thất bại cho user %s", request.user_id)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}") from e


@router.post("/upload_files", response_model=UploadFilesResponse)
async def upload_files(
    files: list[UploadFile] = File(..., description="Danh sách file PDF"),
    user_id: str = Form("default"),
    db_name: str = Form("default"),
    metadata: str = Form("[]", description="JSON array, mỗi phần tử ứng với một file"),
) -> UploadFilesResponse:
    """Upload và index nhiều PDF vào cùng một collection.

    Mỗi file thành một "cuốn" (thư mục đánh số) trong collection; sau khi xong
    mục lục tổng của collection được sinh lại.
    """
    logger.info("Upload | user=%s db=%s files=%d", user_id, db_name, len(files))

    try:
        files_metadata = json.loads(metadata)
        if not isinstance(files_metadata, list):
            raise ValueError("metadata phải là JSON array")
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("metadata không hợp lệ: %s", e)
        return UploadFilesResponse(
            success=False,
            message=f"metadata không hợp lệ: {e}",
            processed_files=0,
            total_pages=0,
            errors=[str(e)],
        )

    if len(files) != len(files_metadata):
        msg = f"Số file ({len(files)}) không khớp số metadata ({len(files_metadata)})"
        logger.error(msg)
        return UploadFilesResponse(
            success=False, message=msg, processed_files=0, total_pages=0, errors=[msg]
        )

    try:
        service = IndexingService(db_name, create_collection=True)
    except Exception as e:
        logger.exception("Không khởi tạo được indexing service")
        raise HTTPException(status_code=500, detail=f"Không kết nối được vector DB: {e}") from e

    processed_files = 0
    total_pages = 0
    file_pages: dict[str, int] = {}
    errors: list[str] = []

    for i, (file, file_meta) in enumerate(zip(files, files_metadata)):
        display_name = file_meta.get("display_name", file.filename)
        tmp_path = None
        try:
            if not file.filename.lower().endswith(".pdf"):
                msg = f"{file.filename} không phải file PDF"
                errors.append(msg)
                logger.warning(msg)
                continue

            logger.info("Xử lý file %d/%d: %s", i + 1, len(files), display_name)

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(await file.read())
                tmp_path = tmp.name

            image_paths = service.index(
                pdf_path=tmp_path,
                media_dir=f"{db_name}/{i}",
                max_pages=file_meta.get("max_pages"),
                custom_config={"vertical_split": file_meta.get("vertical_split", False)},
                metadata={
                    "file_name": display_name,
                    "original_name": file_meta.get("original_name", file.filename),
                    "user_id": db_name,
                    "db_name": db_name,
                },
            )

            file_pages[display_name] = len(image_paths)
            processed_files += 1
            total_pages += len(image_paths)
            logger.info("Đã index %d ảnh-mục cho %s", len(image_paths), display_name)
        except Exception as e:
            msg = f"Lỗi xử lý file {i + 1}/{len(files)} ({display_name}): {e}"
            errors.append(msg)
            logger.exception(msg)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError as e:
                    logger.warning("Không xoá được file tạm %s: %s", tmp_path, e)

    if processed_files:
        try:
            generate_and_save(db_name)
        except Exception as e:
            logger.exception("Không sinh được mục lục cho %s", db_name)
            errors.append(f"Không sinh được mục lục: {e}")

    return UploadFilesResponse(
        success=processed_files > 0,
        message=(
            f"Đã xử lý {processed_files}/{len(files)} file"
            if processed_files
            else "Không file nào được xử lý thành công"
        ),
        processed_files=processed_files,
        total_pages=total_pages,
        file_pages=file_pages,
        errors=errors,
    )


@router.get("/list_collections/{user_id}", response_model=CollectionListResponse)
async def list_collections(user_id: str) -> CollectionListResponse:
    try:
        service = RetrievalService(user_id)
        return CollectionListResponse(user_id=user_id, collections=service.list_collections())
    except Exception as e:
        logger.exception("Không lấy được danh sách collection")
        raise HTTPException(status_code=500, detail=str(e)) from e
