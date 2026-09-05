export type Language = "vi" | "en";

export interface TranslationDictionary {
  app_name: string;
  app_tagline: string;

  // Navigation & Tabs
  nav_chat: string;
  nav_documents: string;
  nav_outline: string;
  nav_new_chat: string;

  // Sidebar
  collections_title: string;
  add_collection: string;
  new_collection_placeholder: string;
  chat_history_title: string;
  no_history: string;
  delete_session: string;
  current_collection: string;

  // Chat & Q&A
  ask_placeholder: string;
  sources_title: string;
  formulas_found: string;
  rewritten_note: string;
  empty_chat_title: string;
  empty_chat_desc: string;

  // Document Canvas
  canvas_title: string;
  toc_button: string;
  search_toc_placeholder: string;
  no_toc: string;
  no_source_selected: string;
  no_source_desc: string;
  zoom_in: string;
  zoom_out: string;
  reset_zoom: string;
  copy_formula: string;
  formula_copied: string;
  view_mode_pdf: string;
  view_mode_slice: string;
  page_counter: string;
  prev_page: string;
  next_page: string;
  open_canvas_btn: string;

  // Documents Library
  documents_title: string;
  drag_drop_pdf: string;
  browse_files: string;
  processing_btn: string;
  in_collection: string;
  open_in_canvas: string;
  total_sections: string;
  total_pages: string;

  // Outline
  outline_title: string;
  refresh_btn: string;
  filter_placeholder: string;

  // Settings
  settings_title: string;
  system_settings_tab: string;
  collection_settings_tab: string;
  general_tab: string;
  runtime_tab: string;
  processing_tab: string;
  fixed_tab: string;
  reset_settings: string;
  save_settings: string;

  // Settings Plain Language Parameters
  top_k_title: string;
  top_k_plain_desc: string;
  top_k_tooltip: string;

  toc_rewrite_title: string;
  toc_rewrite_plain_desc: string;
  toc_rewrite_tooltip: string;

  vlm_temp_title: string;
  vlm_temp_plain_desc: string;
  vlm_temp_tooltip: string;

  dpi_title: string;
  dpi_plain_desc: string;
  dpi_tooltip: string;

  split_title: string;
  split_plain_desc: string;
  split_tooltip: string;

  padding_title: string;
  padding_plain_desc: string;
  padding_tooltip: string;

  // User & Auth
  account: string;
  guest_user: string;
  engineer_user: string;
  sign_in: string;
  sign_out: string;
  switch_account: string;
  language_switch: string;
  language_name: string;
}
