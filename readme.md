# 🏛️ bet.fund / Syndicate Profile Studio

A high-performance, luxury-themed web application and profile customization studio built for elite private banking, alternative investment syndicates, and secure community collaboration.

![Status](https://img.shields.io/badge/status-active-emerald?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-amber?style=for-the-badge)

---

## ✨ Features

* **Secure Authentication Gateway:** Multi-provider authentication supporting Google OAuth via Firebase, secure email/password registration, and a **Quick Test** mode for local development bypass.
* **Unique Handle Claim System:** Enforces mandatory, unique username registration (@handles) to secure identity spaces across the network.
* **Studio Customization Suite:** 
  * Live profile editing (Display name, custom status, and rich biography).
  * Banner & Avatar transformation controls (Zoom, Pan X, and Pan Y adjustments).
  * Direct device file picking with Cloudflare R2 object storage endpoint integration.
* **Elite Badge Manager:** Interactive prestige badge toggling (e.g., *bet.fund Elite Member*, *Syndicate Booster*) with glowing visual effects.
* **Encrypted Terminal / Chat:** Real-time channel for syndicate communication.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, Tailwind CSS (via CDN)
* **Scripting:** Vanilla JavaScript (ES6+)
* **Authentication:** Firebase Auth (v8.10.1)
* **Storage Architecture:** Cloudflare R2 Object Storage Endpoint

---

## 🚀 Quick Start / Local Development

Because this application utilizes modern web components and authentication popups, it is best run through a local development server rather than directly opening the file via `file://`.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/bet-fund-studio.git](https://github.com/your-username/bet-fund-studio.git)
   cd bet-fund-studio