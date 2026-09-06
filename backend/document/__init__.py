"""Pipeline xử lý tài liệu PDF thành các ảnh-mục kèm metadata."""

from .detected_element import DetectedElement
from .document_section import DocumentSection
from .llm_report_valid import ReportValidator

try:
    from .element_detector import ElementDetector
except ImportError:
    ElementDetector = None

try:
    from .pdf_manager import PdfManager
except ImportError:
    PdfManager = None

try:
    from .section_analyzer import SectionAnalyzer
except ImportError:
    SectionAnalyzer = None

try:
    from .section_merger import SectionMerger
except ImportError:
    SectionMerger = None

try:
    from .summary_reporter import SummaryReporter
except ImportError:
    SummaryReporter = None

__all__ = [
    "DetectedElement",
    "DocumentSection",
    "ElementDetector",
    "PdfManager",
    "ReportValidator",
    "SectionAnalyzer",
    "SectionMerger",
    "SummaryReporter",
]
