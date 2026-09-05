import type { TranslationDictionary } from "../types";

export const en: TranslationDictionary = {
  app_name: "Cosmo ChatPDF",
  app_tagline: "Visual RAG Workspace",

  // Navigation & Tabs
  nav_chat: "Chat & Canvas",
  nav_documents: "Documents",
  nav_outline: "Outline",
  nav_new_chat: "New Chat",

  // Sidebar
  collections_title: "Collections",
  add_collection: "Add collection",
  new_collection_placeholder: "New collection name...",
  chat_history_title: "Recent Chats",
  no_history: "No chats yet.",
  delete_session: "Delete chat",
  current_collection: "Active Collection",

  // Chat & Q&A
  ask_placeholder: "Ask about equations, parameters, or specifications in the documents...",
  sources_title: "Citations",
  formulas_found: "formulas",
  rewritten_note: "Standardized query via ToC:",
  empty_chat_title: "Visual RAG & Grounded Inspection",
  empty_chat_desc: "Directly extracts original high-resolution page slices, data tables, and mathematical formulas with page citations for verification.",

  // Document Canvas
  canvas_title: "Document Canvas",
  toc_button: "Table of Contents",
  search_toc_placeholder: "Filter sections...",
  no_toc: "No table of contents available for this collection.",
  no_source_selected: "No document or citation selected",
  no_source_desc: "Click any citation chip in the chat response or select a section in the Outline tree to inspect.",
  zoom_in: "Zoom In",
  zoom_out: "Zoom Out",
  reset_zoom: "Reset Zoom (100%)",
  copy_formula: "Copy formula",
  formula_copied: "Copied to clipboard!",
  view_mode_pdf: "Full PDF View",
  view_mode_slice: "Visual RAG Slice",
  page_counter: "Page",
  prev_page: "Previous Page",
  next_page: "Next Page",
  open_canvas_btn: "Open Canvas",

  // Documents Library
  documents_title: "Document Management",
  drag_drop_pdf: "Drag & drop PDF files here or browse from computer",
  browse_files: "Select PDF files",
  processing_btn: "Start Processing & Indexing",
  in_collection: "Indexed Documents in Collection",
  open_in_canvas: "Open in Canvas",
  total_sections: "sections",
  total_pages: "pages",

  // Outline
  outline_title: "Overall Table of Contents",
  refresh_btn: "Reload",
  filter_placeholder: "Filter sections...",

  // Settings
  settings_title: "System & Collection Settings",
  system_settings_tab: "System Global",
  collection_settings_tab: "Collection Specific",
  general_tab: "General",
  runtime_tab: "Retrieval & VLM",
  processing_tab: "PDF Processing",
  fixed_tab: "Fixed Parameters",
  reset_settings: "Reset to Defaults",
  save_settings: "Save Settings",

  // Settings Plain Language Parameters
  top_k_title: "Maximum Referenced Sections",
  top_k_plain_desc: "The number of most relevant page slices sent to AI for answering.",
  top_k_tooltip: "Higher values provide more comprehensive answers but take longer for visual inference.",

  toc_rewrite_title: "Query Rewrite via ToC Terms",
  toc_rewrite_plain_desc: "Automatically adapts user query to match technical terminology in the document index.",
  toc_rewrite_tooltip: "Helps locate accurate formulas and tables even if you ask informal questions.",

  vlm_temp_title: "Visual Model Temperature",
  vlm_temp_plain_desc: "Level of reasoning creativity when AI reads drawing and equation images.",
  vlm_temp_tooltip: "Recommended at 0 for engineering standards to guarantee exact numerical outputs.",

  dpi_title: "PDF Scanning Resolution (DPI)",
  dpi_plain_desc: "Resolution used when converting PDF vector pages into raster images for OCR.",
  dpi_tooltip: "Higher DPI (e.g. 300) improves reading of tiny subscripts and diagrams but requires more memory.",

  split_title: "Automatic Two-Page Book Splitting",
  split_plain_desc: "Detects side-by-side scanned book spreads and splits them vertically into two pages.",
  split_tooltip: "Ideal for scanned standard books, textbooks, or landscape double-page scans.",

  padding_title: "Section Slice Margin (Padding)",
  padding_plain_desc: "Extra border margin added around extracted sections to avoid clipping formula edges.",
  padding_tooltip: "In pixels (20-60px). Ensures complete visual context surrounding tables and headers.",

  // User & Auth
  account: "Account",
  guest_user: "Guest Visitor",
  engineer_user: "Lead Structural Engineer",
  sign_in: "Sign In",
  sign_out: "Sign Out",
  switch_account: "Switch Account",
  language_switch: "Language / Ngôn ngữ",
  language_name: "English",
};
