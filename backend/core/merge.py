"""Trộn sâu hai dict cấu hình."""

from typing import Any


def deep_merge(base: dict[str, Any] | None, override: dict[str, Any] | None) -> dict:
    """Trả về dict mới: `override` thắng, nhưng dict con thì trộn tiếp.

    `None` trong `override` nghĩa là "không nói gì", không phải "đặt về rỗng" —
    nhờ vậy client gửi thiếu trường thì cấu hình đã lưu của bộ vẫn được giữ.
    Nếu coi None là giá trị thật thì mỗi lần upload là mất cấu hình bộ.

    Không sửa `base` lẫn `override`.
    """
    result = dict(base or {})

    for key, value in (override or {}).items():
        if value is None:
            continue

        current = result.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            result[key] = deep_merge(current, value)
        else:
            result[key] = value

    return result
