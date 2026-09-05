/**
 * Hội thoại mẫu để đánh giá giao diện khi chưa có backend và GPU.
 *
 * Bật bằng `?mock=1` trên URL. Nội dung mô phỏng đúng cái backend trả về:
 * câu trả lời tiếng Nhật có trích dẫn số trang (prompt mặc định ép tiếng
 * Nhật), mục cha nhiều bậc, công thức LaTeX, số trang in dạng `-93-`.
 */

import type { AskTurn, SearchResult } from "./types";

export const isMockMode = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mock") === "1";

/** Ảnh SVG giả lập một trang tài liệu để thấy panel nguồn hoạt động. */
function fakePageImage(label: string, lines: number): string {
  const rows = Array.from({ length: lines }, (_, i) => {
    const y = 64 + i * 22;
    const width = 300 + ((i * 47) % 160);
    return `<rect x="48" y="${y}" width="${width}" height="9" rx="2" fill="#d8d5cf"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="${
    120 + lines * 22
  }" viewBox="0 0 520 ${120 + lines * 22}">
    <rect width="520" height="${120 + lines * 22}" fill="#fffefb"/>
    <text x="48" y="40" font-family="serif" font-size="17" fill="#2a2722">${label}</text>
    <rect x="48" y="48" width="424" height="1" fill="#c9c5bd"/>
    ${rows}
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

const source1: SearchResult = {
  section_title: "5.4.4 軸方向圧縮力を受ける部材",
  ancestors: ["5章 鋼部材の限界状態", "5.4 部材の耐荷性能"],
  section_pages: ["-92-", "-93-", "-94-"],
  formulas: [
    {
      content: "\\sigma_c = \\dfrac{N}{A_g} \\le \\sigma_{cud}",
      coordinate: [124, 342, 486, 402],
      page: "-93-",
    },
    {
      content: "\\lambda = \\dfrac{l_e}{r}",
      coordinate: [124, 518, 382, 562],
      page: "-93-",
    },
    {
      content: "\\sigma_{cud} = \\rho_{cg} \\cdot \\rho_{cr} \\cdot \\sigma_{y}",
      coordinate: [124, 664, 512, 708],
      page: "-94-",
    },
  ],
  metadata: { file_name: "H29_道示II_quyen1.pdf", db_name: "dao-thi-2" },
  image_path: "/data/metadata/dao-thi-2/0/section_images/section_12_5.4.4.png",
  image_base64: fakePageImage("5.4.4 軸方向圧縮力を受ける部材", 14),
  chunk_images: [
    fakePageImage("-92-", 8),
    fakePageImage("-93-", 9),
  ],
};

const source2: SearchResult = {
  section_title: "5.4.5 軸方向引張力を受ける部材",
  ancestors: ["5章 鋼部材の限界状態", "5.4 部材の耐荷性能"],
  section_pages: ["-95-"],
  formulas: [
    {
      content: "\\sigma_t = \\dfrac{N}{A_e} \\le \\sigma_{tud}",
      coordinate: [124, 288, 478, 336],
      page: "-95-",
    },
  ],
  metadata: { file_name: "H29_道示II_quyen1.pdf", db_name: "dao-thi-2" },
  image_path: "/data/metadata/dao-thi-2/0/section_images/section_13_5.4.5.png",
  image_base64: fakePageImage("5.4.5 軸方向引張力を受ける部材", 10),
  chunk_images: [fakePageImage("-95-", 10)],
};

const source3: SearchResult = {
  section_title: "3.3 作用の組合せ",
  ancestors: ["3章 作用"],
  section_pages: ["-18-", "-19-"],
  formulas: [],
  metadata: { file_name: "H29_道示II_quyen1.pdf", db_name: "dao-thi-2" },
  image_path: "/data/metadata/dao-thi-2/0/section_images/section_09_3.3.png",
  // Trường hợp ảnh không tải được: để kiểm tra trạng thái lỗi của panel.
  image_base64: null,
  chunk_images: [],
};

export const mockTurns: AskTurn[] = [
  {
    id: "mock-1",
    question: "Hệ số an toàn cho cột thép chịu nén dọc trục lấy theo bảng nào?",
    status: "done",
    rewrittenQuery: "軸方向圧縮力を受ける部材の安全率および座屈強度",
    answer:
      "軸方向圧縮力を受ける部材の照査は、5.4.4項（p.-93-）に規定されています。\n\n" +
      "照査式は σc = N/Ag ≤ σcud です。ここで σcud は圧縮応力度の制限値で、\n" +
      "部材の細長比 λ = le/r に応じて表5.4.1（p.-94-）から求めます。\n\n" +
      "細長比が大きい場合は座屈の影響が支配的になるため、ρcg（全体座屈に対する\n" +
      "低減係数）と ρcr（局部座屈に対する低減係数）を乗じた値を用います。\n\n" +
      "なお引張力を受ける部材については 5.4.5項（p.-95-）を参照してください。",
    sources: [source1, source2],
  },
  {
    id: "mock-2",
    question: "Còn tổ hợp tác động thì quy định ở đâu?",
    status: "done",
    rewrittenQuery: "作用の組合せに関する規定",
    answer:
      "作用の組合せは3.3項（p.-18-〜-19-）に規定されています。\n\n" +
      "設計状況ごとに、永続作用・変動作用・偶発作用の組合せ係数を定めており、\n" +
      "限界状態1から3のそれぞれに対して適用する組合せが表で示されています。\n\n" +
      "ただし提供された画像では表の一部が読み取れないため、正確な係数値は\n" +
      "原典 p.-19- をご確認ください。",
    sources: [source3],
  },
  {
    id: "mock-3",
    question: "Tiêu chuẩn này có quy định về vật liệu composite không?",
    status: "done",
    answer:
      "提供された資料の中には、複合材料（composite material）に関する規定は\n" +
      "見当たりませんでした。\n\n" +
      "本資料は鋼部材および鋼コンクリート合成構造を対象としているため、\n" +
      "繊維強化樹脂などの複合材料については別の基準を参照する必要があります。",
    sources: [],
  },
];

/** Lượt đang chạy, để xem trạng thái chờ. */
export const mockPendingTurn: AskTurn = {
  id: "mock-pending",
  question: "Chiều dày tối thiểu của bản thép là bao nhiêu?",
  status: "pending",
  answer: "",
  sources: [],
};

/** Lượt lỗi, để xem trạng thái báo lỗi. */
export const mockErrorTurn: AskTurn = {
  id: "mock-error",
  question: "Câu hỏi khi backend chết giữa đường",
  status: "error",
  answer: "",
  sources: [],
  error: "500: VLM endpoint không phản hồi sau 1000s",
};
