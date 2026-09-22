#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(tauri_plugin_fs::init());
  #[cfg(feature = "webdriver")]
  let builder = builder
    .plugin(tauri_plugin_wdio::init())
    .plugin(tauri_plugin_wdio_webdriver::init());
  builder
    .setup(|app| {
      if cfg!(debug_assertions) && !cfg!(feature = "webdriver") {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
