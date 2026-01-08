# MineSSH for macOS

MineSSH is a modern, intelligent SSH client designed specifically for macOS. It seamlessly integrates a powerful AI assistant with a robust terminal emulator, transforming how you interact with remote servers.

<img width="2400" height="1410" alt="image" src="https://github.com/user-attachments/assets/ea7cac8d-2e63-41e9-a2d3-afffe154f7f9" />


## 🚀 Key Features

### 🤖 Deep AI Integration
*   **Context-Aware**: The AI assistant "sees" your terminal output, allowing it to diagnose errors, explain logs, and suggest next steps based on real-time data.
*   **Auto-Execution**: Can automatically run commands in your SSH session (with your permission), including handling interactive prompts (e.g., `[Y/n]`, selection menus).
*   **Multi-Provider Support**: 
    *   **Ollama**: Run local LLMs completely offline for privacy.
    *   **DeepSeek**: Optimized integration for coding and system tasks.
    *   **OpenAI Compatible**: Connect to any OpenAI-compatible API.
*   **Role Management**: Create, save, and switch between different AI personas (System Prompts) for different tasks (e.g., "DB Admin", "Security Auditor").

### 💻 Powerful Terminal
*   **Built on Xterm.js**: Industry-standard terminal emulation with full color support.
*   **SSH Protocol**: Secure connections via `ssh2`.
*   **Smart Interaction**: 
    *   Handles complex interactive commands (e.g., `top`, `vim`, package managers).
    *   Visual indicators for running commands.
    *   Clean UI separating AI thinking from command execution.

### 🎨 Modern macOS UI
*   **Tech Stack**: Built with Electron, React, TypeScript, and Tailwind CSS.
*   **Aesthetics**: Frosted glass effects, smooth animations, and a clean, dark-mode-first design that fits right into macOS.

## 🛠 Tech Stack

*   **Frontend**: React, TypeScript, Tailwind CSS, Lucide React, Zustand
*   **Backend (Main Process)**: Electron, Node.js, ssh2
*   **Build Tool**: Vite
*   **Terminal Engine**: Xterm.js

## 📦 Installation & Development

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/minetaper/minessh-mac.git
    cd minessh-mac
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

### Running in Development Mode

Start the Vite dev server and Electron app simultaneously:

```bash
npm run dev
```

### Building for Production

Build the application for macOS (creates a `.dmg` or `.app` in `release/`):

```bash
npm run build
```

## 📖 Usage Guide

1.  **Connect to Server**:
    *   Enter your Host, Port (default 22), Username, and Password in the connection panel.
    *   Click "Connect" to start a session.

2.  **Configure AI**:
    *   Click the **Settings** icon in the chat interface.
    *   Select your provider (Ollama, DeepSeek, or OpenAI).
    *   Enter your API Key (if required) and Base URL.
    *   (Optional) Enable "Auto-run commands" for a smoother hands-free experience.

3.  **Interact with AI**:
    *   Type your request (e.g., "Check disk usage and clean up old logs").
    *   The AI will analyze the request and propose commands.
    *   If "Auto-run" is off, click the executed command block to run it.
    *   The AI reads the output and continues the task automatically.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
