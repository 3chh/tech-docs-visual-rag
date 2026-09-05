"""Dùng LLM sửa cây mục lục do layout detection sinh ra.

Layout model chỉ biết "đây là một tiêu đề", không biết 5.4.2 là con của 5.4.
LLM lọc tiêu đề giả và dựng quan hệ cha-con; mục bị loại được gộp ngược vào
mục liền trước để không sinh chunk rác.
"""

import json

from ..core.logging import get_logger
from ..prompts.ToC_val_prompts import (
    output_sample_1,
    output_sample_2,
    prompt,
    prompt_sample_1,
    prompt_sample_2,
    system_prompt,
)

logger = get_logger(__name__)

# Mục cao dưới ngưỡng này (cùng trang, chênh y nhỏ) coi như chỉ có tiêu đề,
# không có nội dung — gộp vào mục trước thay vì để thành chunk rỗng.
MIN_SECTION_HEIGHT_PX = 170


class ReportValidator:
    def __init__(self, config):
        self.model_name = config.get("model_name", "OpenGVLab/InternVL3-8B")
        self.temperature = config.get("temperature", 0.0)
        self.api_key = config.get("api_key", "EMPTY")

        # Cả Gemini lẫn vLLM đều nói giao thức OpenAI, nên chỉ cần một client.
        # (Gemini qua https://generativelanguage.googleapis.com/v1beta/openai/)
        from openai import OpenAI

        self.client = OpenAI(
            base_url=config.get("endpoint", "https://api.openai.com/v1"),
            api_key=self.api_key,
        )

    def _call_llm(self, full_prompt: str) -> dict:
        completion = self.client.chat.completions.create(
            model=self.model_name,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_sample_1},
                {"role": "assistant", "content": json.dumps(output_sample_1, ensure_ascii=False)},
                {"role": "user", "content": prompt_sample_2},
                {"role": "assistant", "content": json.dumps(output_sample_2, ensure_ascii=False)},
                {"role": "user", "content": full_prompt},
            ],
            response_format={"type": "json_object"},
        )
        response_content = completion.choices[0].message.content
        logger.debug("Phản hồi LLM: %s", response_content)
        return json.loads(response_content)

    @staticmethod
    def _merge_into_previous(sections: list, index: int, section: dict) -> None:
        """Gộp `section` vào phần tử liền trước, nới rộng vùng trang/toạ độ."""
        previous = sections[index - 1]
        previous["page_range"] = (
            f"{previous['page_range'].split('-')[0]}-{section['page_range'].split('-')[1]}"
        )
        previous["precise_range"]["end_page"] = section["precise_range"]["end_page"]
        previous["precise_range"]["end_y"] = section["precise_range"]["end_y"]
        previous["precise_range"]["page_numbers"] = list(
            set(previous["precise_range"]["page_numbers"] + section["precise_range"]["page_numbers"])
        )
        previous["total_elements"] += section["total_elements"]
        previous["formulas"] += section["formulas"]
        previous["numbers"] += section["numbers"]

    @staticmethod
    def _is_title_only(section: dict) -> bool:
        pr = section["precise_range"]
        return pr["end_page"] == pr["start_page"] and pr["end_y"] - pr["start_y"] < MIN_SECTION_HEIGHT_PX

    def validate_report(self, report: dict) -> dict:
        extracted_sections = {
            "sections": [
                {"index": section["index"], "title": section["title"]}
                for section in report["sections"]
            ]
        }
        logger.info("Gửi %d tiêu đề cho LLM kiểm tra", len(extracted_sections["sections"]))

        full_prompt = f"{prompt}\n{json.dumps(extracted_sections, ensure_ascii=False, indent=4)}"

        selected_sections: dict = {}
        try:
            selected_sections = self._call_llm(full_prompt)
        except Exception as e:
            # Không chặn pipeline: giữ nguyên toàn bộ mục như layout detection sinh ra.
            logger.error("LLM sửa mục lục thất bại, giữ nguyên báo cáo gốc: %s", e)

        new_report = report.copy()
        new_report["sections"] = []
        i = 0
        for section in report["sections"]:
            if section["index"] == 0 and section["title"] == "noname":
                section["ancestors"] = []
                section["ancestor_titles"] = []
                new_report["sections"].append(section)
                i += 1
                continue

            if str(section["index"]) in selected_sections:
                section_info = selected_sections[str(section["index"])]
                section["ancestors"] = section_info.get("ancestors", [])
                section["ancestor_titles"] = [
                    report["sections"][a]["title"] for a in section["ancestors"]
                ]
                new_report["sections"].append(section)
                i += 1
            elif i > 0:
                # Mục bị LLM loại: trả nội dung của nó về mục cha liền trước.
                self._merge_into_previous(new_report["sections"], i, section)

        # Mục làm tổ tiên nhưng chỉ có tiêu đề thì bỏ hẳn.
        all_ancestors: set[int] = set()
        for section in new_report["sections"]:
            all_ancestors.update(section["ancestors"])

        for section in list(new_report["sections"]):
            if section["index"] in all_ancestors and self._is_title_only(section):
                logger.debug("Bỏ mục tổ tiên rỗng: %s", section["index"])
                new_report["sections"].remove(section)

        # Các mục chỉ-có-tiêu-đề còn lại thì gộp vào mục trước.
        for i, section in enumerate(list(new_report["sections"])):
            if i > 0 and self._is_title_only(section):
                self._merge_into_previous(new_report["sections"], i, section)
                new_report["sections"].remove(section)

        new_report["total_sections"] = len(new_report["sections"])
        logger.info(
            "Mục lục sau kiểm tra: %d mục (trước: %d)",
            new_report["total_sections"],
            len(report["sections"]),
        )
        return new_report
