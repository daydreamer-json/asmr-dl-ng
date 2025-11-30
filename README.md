# asmr-dl-ng

A simple program for downloading ASMR content.

## Features ✨

- ⚡ High-speed, efficient downloads via parallel processing and stream writing
- 🔒 Secure, robust downloads with throughput monitoring and hash verification
  - 🔄 Automatic retries if no data is received for a set period (customizable threshold seconds and retry count)
  - 🧮 Hash verification using SHA-256, SHA-384, SHA-512, SHA3-512
- 📁 Customizable folder naming rules
- ❌ Automated file exclusion using regular expressions
- 🎨 Elegant and fancy command-line UI

## Requirements 💻

- 🪟 Windows 10/11 x64 environment
  - Linux support is still under development.
- Free disk space for downloading content

## How to use 📥

📥 Download the latest installer from the GitHub Releases page.  
Is the Releases page confusing? Please click [here](https://gitload.net/daydreamer-json/asmr-dl-ng/).

🛠️ Run the installer.  
Alternatively, download the `zip` file, extract it somewhere, and add the extracted directory to PATH environment variable.  
Installer automatically adds the installation directory to the PATH environment variable.

💻 Open the terminal (`cmd` or something like that).

🚀 Let's get started by typing a command!

```sh
# Show help
asmr-dl-ng -h

# Download work
asmr-dl-ng dl 123456
```

When the command is executed, a configuration file is automatically generated within the `%APPDATA%\asmr-dl-ng` folder.  
To change the program's behavior, modify the contents of the file.

## Technology stack 🛠️

- 🐰 Bun (Runtime & Package Manager)
- 🔤 TypeScript (Language)
- 📦 Parcel (Bundler)
- 🧹 Biome (Formatter & Linter)
- 🪛 Inno Setup (Installer)
- 📦 7-zip (Archiver)

## Build 🔨

### Requirements

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh)
- [7-zip](https://www.7-zip.org/download.html) >= v22
- [Inno Setup](https://jrsoftware.org/isinfo.php) >= latest

```bat
git clone https://github.com/daydreamer-json/asmr-dl-ng.git
cd asmr-dl-ng
bun install
bun run build
build-rel.bat
```

## Disclaimer

This project has no affiliation with DLsite and was created solely for private use, educational, and research purposes.

I assume no responsibility whatsoever. Please use it at your own risk.

---

(C) daydreamer-json
