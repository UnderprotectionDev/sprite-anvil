fn main() {
  println!("cargo:rerun-if-changed=capabilities");
  let capabilities = if cfg!(feature = "webdriver") {
    "./capabilities/*.json"
  } else {
    "./capabilities/default.json"
  };
  tauri_build::try_build(
    tauri_build::Attributes::new().capabilities_path_pattern(capabilities),
  )
  .expect("failed to build desktop capabilities");
}
