system_prompt = """You are an expert document hierarchy processor. Your task is to analyze a list of document sections provided in JSON format, identify valid hierarchical headings, clean their titles, and reconstruct their complete ancestor lineage.

**Here are the strict rules and guidelines you must follow:**

1.  **Input Analysis:** You will receive a JSON object containing a `"sections"` array. Each item in this array has an `"index"` (integer) and a `"title"` (string).

2.  **Section Filtering and Validation:**
    *   **Identify Valid Headings Only:** Process the input `sections` list sequentially. Only sections that represent clear and standard hierarchical headings should be included in the output.
    *   **Valid Heading Patterns:** Recognize typical hierarchical numbering patterns. These generally include:
        *   Full numeric patterns (e.g., "1", "1.1", "1.1.1", "2.2.1.1", "2.3.1.1.1", "12.5.3").
        *   Chapter-based numeric patterns (e.g., "1章", "3章", "I章", "II章").
        *   Combinations where a numeric sub-section logically follows a chapter heading (e.g., "1.1" can be a child of "1章").
    *   **Exclude Invalid Sections:** Sections that do *not* match these hierarchical patterns must be entirely excluded from the output. This includes:
        *   Non-heading content or informal labels (e.g., "noname", "目次", "I共通編", "橋の耐荷性能1", "橋の耐荷性能2").
        *   Headings with invalid prefixes or structures that break the standard hierarchy (e.g., "ad 2.3.1.3 abc").
        *   Specific list items or sub-points marked with parentheses or Roman numerals, which are not considered main hierarchical sections (e.g., "1) ...", "2) ...", "i) ...").

3.  **Title Cleaning:** For each *valid* section identified, use its original title. You may strip only leading or trailing whitespace, but do not otherwise modify the title text (e.g., do not remove numbers, change phrasing, etc.).

4.  **Hierarchy Construction (Ancestors):**
    *   **Parent-Child Relationship:** Determine the hierarchical relationship between valid sections. A section `C` is considered a child of a valid section `P` if `C`'s heading pattern represents a direct sub-level of `P`'s heading pattern. For example:
        *   "X.Y" is a child of "X" (or "X章").
        *   "X.Y.Z" is a child of "X.Y".
    *   **Temporal Order:** A parent section must always appear *before* its child in the original input `sections` list.
    *   **Valid Parents Only:** Only sections that have themselves been identified as *valid and included* in the final output can be considered as ancestors.
    *   **Ancestor List Order:** The `ancestors` array for a given section must be an ordered list of integer indices, starting from the highest-level ancestor (e.g., grandparent) down to the immediate parent.
    *   **Root Sections:** If a valid section has no valid parent among the preceding valid sections, its `ancestors` list should be empty.

5.  **Output Format:**
    *   The final output must be a single JSON object (dictionary).
    *   Keys of this object must be the `index` of the valid section, represented as a **string** (e.g., "1", "5").
    *   Values must be objects with exactly two properties:
        *   `"title"`: The cleaned section title (string).
        *   `"ancestors"`: An array of integers representing the ordered lineage of ancestor indices.

Do not include any other text or explanation in your response, only the final JSON object."""

prompt = """Please process the following JSON data to extract and structure hierarchical document sections. Identify valid headings, clean their titles, and build the complete ancestor lineage as described in your instructions. Return ONLY the final, valid JSON object.

Input JSON:"""

output_schema = {
    "type": "object",
    "description": "A dictionary mapping section indices (as strings) to their details, including the full lineage of ancestor sections.",
    "additionalProperties": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The cleaned, valid section title."
            },
            "ancestors": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "An ordered list of ancestor indices, from the highest-level ancestor to the immediate parent. Empty if the section is a root."
            }
        },
        "required": ["title", "ancestors"]
    }
}

prompt_sample_1 = """Please process the following JSON data to extract and structure hierarchical document sections. Identify valid headings, clean their titles, and build the complete ancestor lineage as described in your instructions. Return ONLY the final, valid JSON object.

Input JSON:
{
    "sections": [
        {
            "index": 0,
            "title": "noname"
        },
        {
            "index": 1,
            "title": "2.2.1 uii"
        },
        {
            "index": 2,
            "title": "2.3.1 jqk"
        },
        {
            "index": 3,
            "title": "ad 2.3.1.3 abc"
        },
        {
            "index": 4,
            "title": "(1)座屈安全率V_B"
        },
        {
            "index": 5,
            "title": "2.3.1.1 def"
        },
        {
            "index": 6,
            "title": "2.3.1.1.1 ghi"
        },
        {
            "index": 7,
            "title": "2.3.1.1.2 reta"
        }
    ]
}"""

output_sample_1 = {
    "1": {
        "title": "2.2.1 uii",
        "ancestors": [],
    },
    "2": {
        "title": "2.3.1 jqk",
        "ancestors": [],
    },
    "5": {
        "title": "2.3.1.1 def",
        "ancestors": [2],
    },
    "6": {
        "title": "2.3.1.1.1 ghi",
        "ancestors": [2, 5],
    },
    "7": {
        "title": "2.3.1.1.2 reta",
        "ancestors": [2, 5],
    }
}

prompt_sample_2 = """PPlease process the following JSON data to extract and structure hierarchical document sections. Identify valid headings, clean their titles, and build the complete ancestor lineage as described in your instructions. Return ONLY the final, valid JSON object.

Input JSON:
{
    "sections": [
        {
            "index": 0,
            "title": "noname"
        },
        {
            "index": 1,
            "title": "目次"
        },
        {
            "index": 2,
            "title": "I共通編"
        },
        {
            "index": 3,
            "title": "1章総則"
        },
        {
            "index": 4,
            "title": "1.1適用の範囲"
        },
        {
            "index": 5,
            "title": "橋の耐荷性能1"
        },
        {
            "index": 6,
            "title": "橋の耐荷性能2"
        },
        {
            "index": 7,
            "title": "3章 設計状況"
        },
        {
            "index": 8,
            "title": "3.1作用の種類"
        },
        {
            "index": 9,
            "title": "1)水平補剛材を用いない場合"
        },
        {
            "index": 10,
            "title": "2)水平補剛材を1段用いる場合"
        },
        {
            "index": 11,
            "title": "3.2 設計状況の設定"
        },
        {
            "index": 12,
            "title": "3.3作用の組合せ"
        },
        {
            "index": 13,
            "title": "3.3.1荷重組合せ，荷重組合せ係数及び荷重係数の検討に用いられた理論"
        },
        {
            "index": 14,
            "title": "i）荷重組合せ，荷重組合せ係数及び荷重係数の検討に用いられた理論"
        }
    ]
}"""

output_sample_2 = {
    "3": {
        "title": "1章総則",
        "ancestors": [],
    },
    "4": {
        "title": "1.1適用の範囲",
        "ancestors": [3],
    },
    "7": {
        "title": "3章 設計状況",
        "ancestors": [],
    },
    "8": {
        "title": "3.1作用の種類",
        "ancestors": [7],
    },
    "11": {
        "title": "3.2 設計状況の設定",
        "ancestors": [7],
    },
    "12": {
        "title": "3.3作用の組合せ",
        "ancestors": [7],
    },
    "13": {
        "title": "3.3.1荷重組合せ，荷重組合せ係数及び荷重係数の検討に用いられた理論",
        "ancestors": [7, 12],
    }
}