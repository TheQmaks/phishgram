# phishgram - Telegram Web Authentication

> ⚠️ **LEGAL DISCLAIMER**: This tool is intended ONLY for authorized security testing, red-team operations, and educational purposes. Using this tool without explicit permission from the target is ILLEGAL and unethical. The authors are not responsible for any misuse or damage caused by this tool.

A credential harvesting framework that creates a fake Telegram login interface to capture user credentials, then automatically submits them to the real Telegram Web to verify their validity. Designed for authorized penetration testing and security assessments.

## ✨ Features

- 🚀 One-command setup with Cloudflare tunnel
- 🎭 Authentic Telegram UI with animations
- 🔄 Real-time credential validation via Puppeteer
- 🎯 Multi-step auth support (phone, SMS, 2FA)
- 📱 Mobile-responsive design

## 🏗️ How it Works

1. Serves fake Telegram login interface via tunnel URL
2. Captures credentials through WebSocket
3. Validates credentials against real web.telegram.org using Puppeteer
4. Redirects target to real Telegram upon success

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Git**: For cloning the repository
- **Cloudflare Tunnel** (cloudflared): For public URL generation
  - Installation: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

## 🤖 Mini App Setup (Optional)

1. Get bot token from [@BotFather](https://t.me/botfather)
2. Run setup to get your URL:
```bash
BOT_TOKEN=your_token npm run setup
```
3. Enable Mini App in BotFather:
   - Go to @BotFather → Your Bot → Bot Settings → Configure Mini App
   - Enable Mini App
   - Set the provided tunnel URL
   - You can also adjust the **Splash Icon** ([lock.svg](./assets/lock.svg)) and set the **Background Color** and **Header Color** to `#ffffffff` for both themes

## 💡 Usage

```bash
# Local testing
npm start

# Public URL with tunnel
npm run setup
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details