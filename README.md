# 🤖 Detoxify — Chrome Extension

Retrain your YouTube algorithm by silently watching curated long-form content in background tabs.

---

## 📦 How to Install (No Node.js needed!)

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select this `detoxify-extension` folder
5. The Detoxify icon will appear in your Chrome toolbar!

---

## 🚀 How to Use

1. Make sure you're **logged into YouTube** in Chrome
2. Click the Detoxify extension icon
3. Enter your **topic** (e.g., "Machine Learning", "Guitar Lessons")
4. Choose a **session duration**
5. Click **⚡ INITIATE DETOX**

The extension will open YouTube videos in background tabs, watch them for 30 seconds each, then close them automatically.

---

## ⚠️ Important Notes

- Keep Chrome open during a session
- Videos open as **background tabs** — you can keep browsing normally
- **API Key**: The YouTube API key is embedded. It has a daily quota of 10,000 units. If you hit the limit, get your own free key at [console.cloud.google.com](https://console.cloud.google.com)
- YouTube's ToS prohibits automated watch behavior — use responsibly and only on your own account

---

## 🔑 Get Your Own API Key (Optional)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **YouTube Data API v3**
3. Create an API Key credential
4. Replace the key in `popup.js` line 3

---

## 📁 File Structure

```
detoxify-extension/
├── manifest.json     ← Extension config
├── popup.html        ← UI
├── popup.js          ← Main logic
├── background.js     ← Service worker
├── icons/            ← Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
