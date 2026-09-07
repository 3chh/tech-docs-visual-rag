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

  // Settings Dialog (Left Sidebar Layout)
  settings_modal_title: string;
  settings_modal_subtitle: string;
  settings_group_general: string;
  settings_group_infrastructure: string;
  settings_tab_general: string;
  settings_tab_general_desc: string;
  settings_tab_models: string;
  settings_tab_models_desc: string;
  settings_tab_vectordb: string;
  settings_tab_vectordb_desc: string;
  settings_tab_storage: string;
  settings_tab_storage_desc: string;
  settings_close_btn: string;
  settings_language_label: string;
  settings_language_desc: string;
  settings_runtime_info: string;
  settings_version_label: string;
  settings_environment_label: string;

  // Technical parameters in Settings
  settings_qdrant_host: string;
  settings_qdrant_collection: string;
  settings_search_limit: string;
  settings_embed_model: string;
  settings_compute_device: string;
  settings_vector_dim: string;
  settings_max_visual_tokens: string;
  settings_batching_mode: string;
  settings_metadata_dir: string;
  settings_data_dir: string;
  settings_worker_endpoint: string;
  settings_log_level: string;
  settings_immutable_notice: string;

  // Model Connections
  conn_header_title: string;
  conn_header_desc: string;
  conn_add_btn: string;
  conn_empty_title: string;
  conn_empty_desc: string;
  conn_name_label: string;
  conn_provider_label: string;
  conn_model_label: string;
  conn_endpoint_label: string;
  conn_key_label: string;
  conn_key_placeholder_new: string;
  conn_key_placeholder_edit: string;
  conn_capabilities_label: string;
  conn_cap_vlm: string;
  conn_cap_llm: string;
  conn_save_btn: string;
  conn_cancel_btn: string;
  conn_delete_confirm: string;
  conn_self_hosted_badge: string;
  conn_cloud_badge: string;

  // Workspace & Canvas
  workspace_section_title: string;
  sidebar_collapse_tooltip: string;
  sidebar_expand_tooltip: string;
  doc_configure_btn: string;
  doc_create_btn: string;
  doc_stat_books: string;
  doc_stat_pages: string;
  doc_stat_sections: string;
  canvas_toggle_outline: string;
  canvas_mode_slice: string;
  canvas_mode_pdf: string;
  canvas_expand: string;
  canvas_collapse: string;
  canvas_close: string;
  canvas_verified_citation: string;
  canvas_ref_page: string;
  canvas_formulas_title: string;
  canvas_copy_latex: string;

  // Collection Settings Dialog
  col_settings_title: string;
  col_settings_not_configured: string;
  col_settings_select_model_hint: string;
  col_settings_display_name: string;
  col_settings_processing_params: string;
  col_settings_changed_suffix: string;
  col_settings_processing_desc: string;
  col_settings_frozen_embedding_desc: string;
  col_settings_save_btn: string;

  // Sample Queries
  sample_q1: string;
  sample_q2: string;
  sample_q3: string;
}
