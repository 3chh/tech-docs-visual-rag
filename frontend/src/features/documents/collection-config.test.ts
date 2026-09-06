import { describe, expect, it } from "vitest";

import {
  COLLECTION_FIELD_GROUPS,
  countOverrides,
  EMPTY_DRAFT,
  getPath,
  setDraftValue,
  slugify,
} from "./collection-config";

describe("setDraftValue giữ draft thưa", () => {
  it("đặt giá trị lồng nhiều tầng", () => {
    const draft = setDraftValue(
      EMPTY_DRAFT,
      ["processing", "preprocess", "pdf_to_image", "dpi"],
      400,
    );

    expect(draft).toEqual({
      processing: { preprocess: { pdf_to_image: { dpi: 400 } } },
      ask: {},
    });
  });

  it("undefined thì XOÁ khoá, không đặt thành null", () => {
    let draft = setDraftValue(EMPTY_DRAFT, ["ask", "top_k"], 12);
    draft = setDraftValue(draft, ["ask", "top_k"], undefined);

    expect(draft.ask).toEqual({});
    expect("top_k" in draft.ask).toBe(false);
  });

  it("dọn luôn object cha khi nó rỗng", () => {
    let draft = setDraftValue(
      EMPTY_DRAFT,
      ["processing", "preprocess", "pdf_to_image", "dpi"],
      400,
    );
    draft = setDraftValue(
      draft,
      ["processing", "preprocess", "pdf_to_image", "dpi"],
      undefined,
    );

    // Không được để lại {preprocess: {pdf_to_image: {}}} — server sẽ nhận
    // object rỗng và ghi đè mất cấu hình cũ khi PUT.
    expect(draft.processing).toEqual({});
  });

  it("giữ nguyên các khoá cùng cấp", () => {
    let draft = setDraftValue(EMPTY_DRAFT, ["processing", "chunking", "cut_padding"], 12);
    draft = setDraftValue(
      draft,
      ["processing", "chunking", "min_section_height_px"],
      80,
    );
    draft = setDraftValue(draft, ["processing", "chunking", "cut_padding"], undefined);

    expect(draft.processing.chunking).toEqual({ min_section_height_px: 80 });
  });

  it("chuỗi rỗng coi như chưa đổi", () => {
    let draft = setDraftValue(
      EMPTY_DRAFT,
      ["processing", "toc_validator", "model_name"],
      "gpt-4o-mini",
    );
    draft = setDraftValue(draft, ["processing", "toc_validator", "model_name"], "");

    expect(draft.processing).toEqual({});
  });

  it("không sửa draft gốc", () => {
    const draft = setDraftValue(EMPTY_DRAFT, ["ask", "top_k"], 12);

    expect(EMPTY_DRAFT.ask).toEqual({});
    expect(draft).not.toBe(EMPTY_DRAFT);
  });

  it("false là giá trị thật, phải giữ lại", () => {
    const draft = setDraftValue(EMPTY_DRAFT, ["ask", "use_toc_rewrite"], false);

    expect(draft.ask.use_toc_rewrite).toBe(false);
  });

  it("0 là giá trị thật, phải giữ lại", () => {
    const draft = setDraftValue(EMPTY_DRAFT, ["processing", "preprocess", "padding"], 0);

    expect(draft.processing.preprocess?.padding).toBe(0);
  });
});

describe("countOverrides", () => {
  it("đếm đúng số trường đã đổi", () => {
    let draft = setDraftValue(EMPTY_DRAFT, ["ask", "top_k"], 12);
    expect(countOverrides(draft)).toBe(1);

    draft = setDraftValue(draft, ["processing", "chunking", "cut_padding"], 20);
    expect(countOverrides(draft)).toBe(2);

    draft = setDraftValue(draft, ["ask", "top_k"], undefined);
    expect(countOverrides(draft)).toBe(1);
  });

  it("draft rỗng thì không có gì bị đổi", () => {
    expect(countOverrides(EMPTY_DRAFT)).toBe(0);
  });
});

describe("bảng field khớp ràng buộc backend", () => {
  const fields = COLLECTION_FIELD_GROUPS.flatMap((g) => g.fields);

  it("mọi path đều bắt đầu bằng processing hoặc ask", () => {
    for (const field of fields) {
      expect(["processing", "ask"]).toContain(field.path[0]);
    }
  });

  it("không có path trùng nhau", () => {
    const keys = fields.map((f) => f.path.join("."));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("field số có min nhỏ hơn max", () => {
    for (const field of fields) {
      if (field.kind === "number") {
        expect(field.min, field.label).toBeLessThan(field.max);
      }
    }
  });

  it("getPath đọc lại được đúng chỗ setPath vừa ghi", () => {
    for (const field of fields) {
      const value = field.kind === "bool" ? true : field.kind === "text" ? "x" : 1;
      const draft = setDraftValue(EMPTY_DRAFT, field.path, value);

      expect(getPath(draft, field.path), field.label).toBe(value);
    }
  });
});

describe("slugify", () => {
  it("bỏ dấu tiếng Việt", () => {
    expect(slugify("Tiêu chuẩn Xây dựng 2024")).toBe("tieu-chuan-xay-dung-2024");
  });

  it("xử lý chữ đ", () => {
    expect(slugify("Đường bộ")).toBe("duong-bo");
  });

  it("không để lại gạch ở đầu hoặc cuối", () => {
    const slug = slugify("  --- QCVN 06:2022 ---  ");

    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("cắt ở 63 ký tự cho khớp giới hạn backend", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(63);
  });

  it("kết quả khớp regex tên bộ của backend", () => {
    const backendRe = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

    for (const name of [
      "Tiêu chuẩn Xây dựng 2024",
      "QCVN 06:2022/BXD",
      "Đường bộ & cầu",
    ]) {
      expect(backendRe.test(slugify(name)), name).toBe(true);
    }
  });
});
