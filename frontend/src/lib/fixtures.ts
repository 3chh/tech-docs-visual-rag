/** Dữ liệu mẫu khớp shape thật của backend, dùng để xem UI khi chưa có GPU. */

import type { AskResponse, SearchResult, TableOfContents } from "./types";

export const sourceFixture: SearchResult = {
  section_title: "5.4.4 軸方向圧縮力を受ける部材",
  ancestors: ["5章 鋼部材の限界状態", "5.4 部材の耐荷性能"],
  section_pages: ["-92-", "-93-"],
  formulas: [
    { content: "\sigma_c = N / A_g \le \sigma_{cud}", coordinate: [120, 340, 480, 400], page: "-93-" },
    { content: "\lambda = l_e / r", coordinate: [120, 520, 380, 560], page: "-93-" },
  ],
  metadata: { file_name: "quyen1.pdf", db_name: "default" },
  image_path: "/data/metadata/default/0/section_images/section_12.png",
  image_base64: null,
  chunk_images: [],
};

export const sourceWithoutFormulas: SearchResult = {
  ...sourceFixture,
  section_title: "5.4.5 軸方向引張力を受ける部材",
  ancestors: ["5章 鋼部材の限界状態", "5.4 部材の耐荷性能"],
  section_pages: ["-95-"],
  formulas: [],
};

export const askFixture: AskResponse = {
  query: "Hệ số an toàn cho cột thép lấy theo bảng nào?",
  answer:
    "Theo mục 5.4.4 (Trang 93), hệ số an toàn cho bộ phận chịu lực nén dọc trục\n" +
    "lấy theo Bảng 5.4.1. Công thức kiểm tra là σc = N/Ag ≤ σcud.\n\n" +
    "Giá trị σcud phụ thuộc độ mảnh λ = le/r, tra ở Bảng 5.4.2 (Trang 94).",
  rewritten_query: "軸方向圧縮力を受ける部材の安全率",
  sources: [sourceFixture, sourceWithoutFormulas],
  total_sources: 2,
};

export const tocFixture: TableOfContents = {
  collection_name: "default",
  total_books: 2,
  books: [
    {
      book_index: 0,
      book_folder: "0",
      title: "1.1 適用の範囲 (29 pages)",
      total_pages: 29,
      total_sections: 6,
      sections: [
        { title: "noname", index: 0, page_range: "0-5", formulas: 0, ancestor_titles: [] },
        { title: "1章 総則", index: 3, page_range: "6-6", formulas: 0, ancestor_titles: [] },
        { title: "1.1 適用の範囲", index: 4, page_range: "6-7", formulas: 0, ancestor_titles: ["1章 総則"] },
        { title: "3.1 作用の種類", index: 5, page_range: "8-12", formulas: 2, ancestor_titles: [] },
      ],
    },
    {
      book_index: 1,
      book_folder: "1",
      title: "5.3.13 圧縮力を受ける山形及びT形断面を有する部材 (111 pages)",
      total_pages: 111,
      total_sections: 59,
      sections: [
        { title: "noname", index: 0, page_range: "0-2", formulas: 0, ancestor_titles: [] },
        { title: "5章 鋼部材の限界状態", index: 1, page_range: "3-5", formulas: 0, ancestor_titles: [] },
        { title: "5.4 部材の耐荷性能", index: 2, page_range: "6-9", formulas: 1, ancestor_titles: ["5章 鋼部材の限界状態"] },
        {
          title: "5.4.4 軸方向圧縮力を受ける部材",
          index: 3,
          page_range: "10-14",
          formulas: 2,
          ancestor_titles: ["5章 鋼部材の限界状態", "5.4 部材の耐荷性能"],
        },
      ],
    },
  ],
};
