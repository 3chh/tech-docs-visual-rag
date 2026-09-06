"""Test chọn nhà cung cấp VLM.

Nguyên tắc: API key luôn ở server, không bao giờ đi ra client. UI chỉ biết
provider nào đã cấu hình, không biết key là gì.
"""

import pytest

from backend.core.providers import get_vlm_provider, list_vlm_providers


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Xoá mọi biến provider để mỗi test tự đặt cái nó cần."""
    for key in (
        "DEFAULT_VLM_PROVIDER",
        "VLM_ENDPOINT",
        "VLM_MODEL_NAME",
        "OPENAI_API_KEY",
        "OPENAI_CLOUD_API_KEY",
        "OPENAI_VLM_MODEL",
        "GEMINI_API_KEY",
        "GEMINI_VLM_MODEL",
        "CUSTOM_VLM_ENDPOINT",
        "CUSTOM_VLM_API_KEY",
        "CUSTOM_VLM_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)


def test_co_du_bon_provider():
    ids = [p.id for p in list_vlm_providers()]

    assert ids == ["builtin", "openai", "gemini", "custom"]


def test_builtin_khong_can_key():
    """vLLM tự host không cần xác thực."""
    builtin = next(p for p in list_vlm_providers() if p.id == "builtin")

    assert builtin.is_configured is True
    assert builtin.needs_gpu is True


def test_provider_ngoai_chua_co_key_thi_chua_cau_hinh():
    providers = {p.id: p for p in list_vlm_providers()}

    assert providers["openai"].is_configured is False
    assert providers["gemini"].is_configured is False
    assert providers["custom"].is_configured is False


def test_co_key_thi_cau_hinh_xong(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")

    gemini = next(p for p in list_vlm_providers() if p.id == "gemini")

    assert gemini.is_configured is True
    assert gemini.needs_gpu is False


def test_provider_ngoai_khong_can_gpu():
    """Đây là lý do chính để chọn API ngoài: tiết kiệm VRAM."""
    for provider in list_vlm_providers():
        if provider.id != "builtin":
            assert provider.needs_gpu is False


def test_key_rieng_cho_openai_dam_may(monkeypatch):
    """OPENAI_API_KEY dùng cho vLLM tự host, không phải cho OpenAI đám mây."""
    monkeypatch.setenv("OPENAI_API_KEY", "EMPTY")

    openai = next(p for p in list_vlm_providers() if p.id == "openai")

    assert openai.is_configured is False

    monkeypatch.setenv("OPENAI_CLOUD_API_KEY", "sk-that")
    openai = next(p for p in list_vlm_providers() if p.id == "openai")

    assert openai.is_configured is True


def test_mac_dinh_lay_tu_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")
    monkeypatch.setenv("DEFAULT_VLM_PROVIDER", "gemini")

    assert get_vlm_provider().id == "gemini"


def test_chon_provider_khong_ton_tai_thi_bao_loi():
    with pytest.raises(ValueError, match="không tồn tại"):
        get_vlm_provider("khong-co-provider-nay")


def test_chon_provider_chua_cau_hinh_thi_noi_ro_bien_nao():
    """Báo lỗi phải chỉ ra biến môi trường cần đặt, không nói chung chung."""
    with pytest.raises(ValueError, match="OPENAI_CLOUD_API_KEY"):
        get_vlm_provider("openai")

    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        get_vlm_provider("gemini")

    with pytest.raises(ValueError, match="CUSTOM_VLM_ENDPOINT"):
        get_vlm_provider("custom")


def test_endpoint_gemini_la_ban_openai_compatible(monkeypatch):
    """Cả bốn provider đều nói giao thức OpenAI nên dùng chung một client."""
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")

    gemini = get_vlm_provider("gemini")

    assert gemini.endpoint.endswith("/openai/")


def test_khong_bao_gio_lo_key_ra_schema():
    """VlmProviderOut gửi ra client không được có trường api_key."""
    from backend.app.schemas.settings import VlmProviderOut

    assert "api_key" not in VlmProviderOut.model_fields
    assert "is_configured" in VlmProviderOut.model_fields
