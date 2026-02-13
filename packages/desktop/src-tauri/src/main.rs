// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let shell = app.shell();
            // Spawn the sidecar server
            let (mut _rx, _child) = shell
                .sidecar("claude-events-server")
                .expect("failed to find sidecar binary")
                .args(["start"])
                .spawn()
                .expect("failed to spawn sidecar");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
