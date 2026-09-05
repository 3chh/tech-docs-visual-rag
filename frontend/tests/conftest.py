"""Mock gradio để test service chạy được mà không cần cài gradio."""

import sys
import types
from unittest.mock import MagicMock

if "gradio" not in sys.modules:
    gradio = types.ModuleType("gradio")
    gradio.__getattr__ = lambda attr: MagicMock()
    gradio.__path__ = []
    sys.modules["gradio"] = gradio
