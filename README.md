# NovaInstall

**Self-installing bilingual admin panel** on Cloudflare Workers + D1.

پنل ادمین عمومی دو زبانه (فارسی / انگلیسی) با نصب خودکار از طریق GitHub Actions.

---

## ✨ Features / امکانات

- 🔐 Authentication (login / logout / change password)
- 📊 Simple dashboard
- 🌍 Bilingual UI (فارسی + English)
- 🚀 **One-click install** via GitHub Actions
- 🔑 Auto-generated strong admin password
- 🗄️ Auto-create D1 database + bind
- 🔒 No personal data collected (privacy-first)
- 📈 Anonymous install counter support

---

## 📦 Install (Recommended)

### 1. Fork this repository

### 2. Create a Cloudflare API Token

Go to [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**

Use the **“Edit Cloudflare Workers”** template, or create a custom token with:

- Account → Workers Scripts → Edit
- Account → D1 → Edit
- Account → Account Settings → Read (optional, for auto-detect)

### 3. Run the Install workflow

1. Open the **Actions** tab of your fork
2. Select **“Install / Deploy NovaInstall”**
3. Click **Run workflow**
4. Paste your **Cloudflare API Token**
5. (Optional) set a custom Worker name
6. Run

After 1–2 minutes the **Summary** will show:

```
🔗 Panel URL
👤 Username : admin
🔑 Password : ************
```

Open the URL → you will see a welcome page with the same credentials → then login and change the password.

---

## 🛠️ Local Development

```bash
npm install
npx wrangler login
npx wrangler d1 create nova-install-db
# put the database_id into wrangler.toml

npm run db:migrate:local
npm run dev
```

Then open `http://localhost:8787`.

---

## 📁 Structure

```
├── .github/workflows/install.yml   # One-click installer
├── migrations/                     # D1 schema
├── public/                         # Frontend (HTML/CSS/JS)
├── src/index.ts                    # Worker (Hono)
├── wrangler.toml
└── package.json
```

---

## 🔒 Security Notes

- Admin password is generated randomly and shown **only once** (Action summary + welcome page).
- Password is stored as PBKDF2-SHA256 hash in D1.
- Session uses signed HTTP-only cookie (7 days).
- No telemetry of personal data. Optional anonymous install counter only.

---

## License

MIT
