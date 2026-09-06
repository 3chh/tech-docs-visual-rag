import type { TranslationDictionary } from "../types";

export const en: TranslationDictionary = {
  app_name: "Cosmo ChatPDF",
  app_tagline: "Document & Drawing Workspace",

  // Navigation & Tabs
  nav_chat: "Lookup",
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
  rewritten_note: "Standardized query:",
  empty_chat_title: "Document Lookup & Verification",
  empty_chat_desc: "Look up specifications, formulas, and verify with original page citations.",

  // Document Canvas
  canvas_title: "Drawings & Documents",
  toc_button: "Table of Contents",
  search_toc_placeholder: "Filter outline...",
  no_toc: "No table of contents for this collection.",
  no_source_selected: "No citation selected",
  no_source_desc: "Select a citation in the chat response to inspect section slice.",
  zoom_in: "Zoom In",
  zoom_out: "Zoom Out",
  reset_zoom: "Reset Zoom (100%)",
  copy_formula: "Copy formula",
  formula_copied: "Copied to clipboard!",
  view_mode_pdf: "Full PDF View",
  view_mode_slice: "Section Slice",
  page_counter: "Page",
  prev_page: "Previous Page",
  next_page: "Next Page",
  open_canvas_btn: "Open Canvas",

  // Documents Library
  documents_title: "Document Management",
  drag_drop_pdf: "Drag & drop PDF files here or browse from computer",
  browse_files: "Select PDF files",
  processing_btn: "Start Processing",
  in_collection: "Documents in Collection",
  open_in_canvas: "Open in Canvas",
  total_sections: "sections",
  total_pages: "pages",

  // Outline
  outline_title: "Table of Contents",
  refresh_btn: "Reload",
  filter_placeholder: "Filter outline...",

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
  top_k_title: "Maximum Citations",
  top_k_plain_desc: "Maximum number of referenced sections per answer.",
  top_k_tooltip: "Higher values provide more detail but take longer to process.",

  toc_rewrite_title: "Query Standardization",
  toc_rewrite_plain_desc: "Automatically adapts query terminology to match table of contents.",
  toc_rewrite_tooltip: "Helps locate accurate formulas and tables.",

  vlm_temp_title: "VLM Temperature",
  vlm_temp_plain_desc: "Strictness level when extracting values and formulas.",
  vlm_temp_tooltip: "Recommended at 0 for exact numerical outputs.",

  dpi_title: "Scanning Resolution (DPI)",
  dpi_plain_desc: "Image resolution when rendering PDF pages.",
  dpi_tooltip: "Higher DPI improves clarity of formulas and fine print.",

  split_title: "Split Two-Page Scans",
  split_plain_desc: "Automatically splits two-page spreads into separate pages.",
  split_tooltip: "Useful for books scanned with two pages per sheet.",

  padding_title: "Section Margin (Padding)",
  padding_plain_desc: "Extra margin around extracted section slices.",
  padding_tooltip: "Ensures formulas and table borders are not clipped.",

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
