# Mowe-Ibafo X Community Fitness Walk 2026 — Backend

Production-ready PHP 8 REST API + Admin Panel for the MIXC Fitness Walk 2026 Event Management System.

---

## Technology Stack

| Layer       | Technology                       |
|-------------|----------------------------------|
| Language    | PHP 8.0+                         |
| Database    | MySQL 5.7+ / MariaDB 10+         |
| Auth        | JWT (HS256, no library required) |
| Images      | PHP GD Library                   |
| QR Codes    | QR Server API (free, no install) |
| Hosting     | cPanel Shared Hosting            |

---

## Project Structure

```
backend/
├── config.php              ← All configuration (single source of truth)
├── verify.php              ← Public QR verification page
├── .htaccess
├── api/
│   ├── index.php           ← API router (all endpoints)
│   └── .htaccess           ← URL rewriting
├── admin/
│   ├── index.html          ← Admin SPA
│   ├── css/style.css
│   └── js/app.js
├── install/
│   └── index.php           ← Web installer
├── controllers/            ← Request handlers
├── middleware/             ← JWT auth middleware
├── helpers/                ← Utilities (JWT, Upload, QR, Pass, Email, CSV)
├── models/                 ← Database models (PDO)
├── database/
│   └── schema.sql          ← MySQL schema
├── uploads/
│   ├── photos/             ← Participant photos
│   ├── flyers/             ← Attendee passes & QR codes
│   ├── sponsors/           ← Sponsor logos
│   └── gallery/            ← Event gallery images
└── logs/
    └── errors.log
```

---

## API Endpoints

### Public
| Method | Endpoint          | Description               |
|--------|-------------------|---------------------------|
| GET    | `/api/`           | Health check              |
| POST   | `/api/register`   | Register participant      |
| GET    | `/api/verify/{id}`| Verify participant (JSON) |
| GET    | `/api/event`      | Get event info            |
| GET    | `/api/sponsors`   | List active sponsors      |
| GET    | `/api/gallery`    | List active gallery       |
| POST   | `/api/contact`    | Submit contact message    |

### Admin (requires Bearer token)
| Method | Endpoint                                   | Description               |
|--------|--------------------------------------------|---------------------------|
| POST   | `/api/admin/login`                         | Admin login               |
| GET    | `/api/admin/dashboard`                     | Dashboard stats           |
| GET    | `/api/admin/participants`                  | List participants         |
| GET    | `/api/admin/participants/{id}`             | Get participant           |
| PUT    | `/api/admin/participants/{id}`             | Update participant        |
| DELETE | `/api/admin/participants/{id}`             | Delete participant        |
| POST   | `/api/admin/participants/{id}/regenerate-pass` | Regenerate pass       |
| POST   | `/api/admin/participants/bulk-delete`      | Bulk delete               |
| GET    | `/api/admin/export/participants`           | Export CSV                |
| GET    | `/api/admin/export/sponsors`              | Export CSV                |
| GET    | `/api/admin/export/contacts`              | Export CSV                |
| POST   | `/api/admin/email/send`                   | Send bulk email           |
| GET/POST/PUT/DELETE | `/api/admin/sponsors`          | Sponsor CRUD              |
| GET/POST/PUT/DELETE | `/api/admin/gallery`           | Gallery CRUD              |
| GET/PUT/DELETE      | `/api/admin/contacts`          | Contact management        |
| GET/PUT             | `/api/admin/event`             | Event settings            |

---

## Default Admin Credentials

After running the installer:

- **Email:** The email you entered during installation
- **Password:** The password you entered during installation

---

## cPanel Deployment Guide

### Step 1 — Create Subdomain
1. Login to cPanel → **Subdomains**
2. Create subdomain: `api.yourdomain.com`
3. Note the document root (e.g. `public_html/api`)

### Step 2 — Upload Backend
1. Compress the `backend/` folder into `backend.zip`
2. cPanel → **File Manager** → Navigate to document root
3. Upload `backend.zip` → Extract
4. All files from `backend/` should be at the subdomain root

### Step 3 — Set Folder Permissions
Via File Manager or SSH:
```bash
chmod 755 uploads/ uploads/photos/ uploads/flyers/ uploads/sponsors/ uploads/gallery/ logs/
```

### Step 4 — Create MySQL Database
1. cPanel → **MySQL Databases**
2. Create database: `whitehal_mixc`
3. Create user: `whitehal_user`
4. Add user to database (All Privileges)

### Step 5 — Run the Installer
1. Visit `https://api.yourdomain.com/install/`
2. Fill in database credentials and admin details
3. Click **Install Now**
4. On success, delete or rename the `install/` directory

### Step 6 — Verify API
Test that the API is working:
```bash
curl https://api.yourdomain.com/api/
# Expected: {"success":true,"message":"Success","data":{"status":"ok","api":"..."}}
```

### Step 7 — Enable HTTPS
Ensure your subdomain has SSL:
1. cPanel → **SSL/TLS** → **Let's Encrypt** (or AutoSSL)
2. Issue certificate for `api.yourdomain.com`

### Step 8 — Test File Uploads
```bash
curl -X POST https://api.yourdomain.com/api/register \
  -F "full_name=Test User" \
  -F "email=test@example.com" \
  -F "phone=08012345678" \
  -F "photo=@/path/to/photo.jpg"
```

### Step 9 — Access Admin Panel
Visit `https://api.yourdomain.com/admin/` and login.

---

## Netlify Deployment Guide (Frontend)

### Step 1 — Install Dependencies
```bash
cd frontend
npm install
```

### Step 2 — Configure Environment Variable
Create `.env.production`:
```
VITE_API_URL=https://api.yourdomain.com/api
```

### Step 3 — Build
```bash
npm run build
```

### Step 4 — Deploy to Netlify
Option A — Drag & Drop:
- Visit [app.netlify.com](https://app.netlify.com)
- Drag the `dist/` folder into the deploy zone

Option B — CLI:
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

### Step 5 — Configure Redirects
Create `public/_redirects`:
```
/*  /index.html  200
```

### Step 6 — Set Environment Variables in Netlify
1. Netlify Dashboard → Site Settings → Environment Variables
2. Add: `VITE_API_URL` = `https://api.yourdomain.com/api`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 500 on API | Check `logs/errors.log`; verify PHP version ≥ 8 |
| Uploads fail | `chmod 755 uploads/` and subdirectories |
| QR codes don't generate | Server needs outbound HTTP to `api.qrserver.com` |
| Pass image is blank | Ensure GD extension is enabled: `php -m \| grep gd` |
| CORS errors | Set `FRONTEND_URL` in `config.php` to your Netlify URL |
| 404 on API routes | Verify `.htaccess` + `mod_rewrite` is enabled |
| Emails not sending | Use cPanel's SMTP in `config.php`, or a transactional email service |

---

## Security Notes

- All DB queries use PDO prepared statements (SQL injection protected)
- File uploads validated by MIME type + extension
- Uploaded files cannot execute PHP (`.htaccess` in `uploads/`)
- JWT tokens expire in 24 hours
- Passwords hashed with `bcrypt` (cost 12)
- Input sanitized with `htmlspecialchars` before storage
- After installation: delete or password-protect the `install/` directory

---

## Support

WhatsApp: https://wa.me/2347061038567
Twitter: https://x.com/MoweTwitta
