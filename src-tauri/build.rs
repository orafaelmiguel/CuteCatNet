fn main() {
    println!("cargo:rustc-link-lib=Packet");
    println!("cargo:rustc-link-lib=wpcap");
    println!("cargo:rustc-link-search=native=C:/Program Files/Npcap/sdk/Lib/x64"); // ajuste o caminho
    tauri_build::build()
}
