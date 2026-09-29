# Casa Dojo — Judo Club Manager

A lightweight management app for a judo dojo: student roster, belts and black-belt progression,
monthly subscriptions and payments, WhatsApp payment reminders, notes and per-student files.

Data is stored **on disk, one folder per student**, so there is no database to install and every
record stays readable and easy to back up.

| Part | Tech |
|---|---|
| `dojo-manager/` | React 19 + Vite single-page app |
| `dojo-backend/` | Node.js + Express 5 REST API, file-system storage (fs-extra, multer) |

---

## Features

- **Roster** — search by name or phone, filter by belt, class and payment status
- **Dashboard** — total members, paid this month, kata certified, average black-belt progress,
  belt distribution, list of unpaid subscriptions
- **Student profile** — info, belt, fee, black-belt progression (0–100), photo
- **Payments** — record payments per month and mode, payment history, "unpaid past the 5th" banner
- **WhatsApp reminders** — one click opens a pre-filled payment reminder
- **Notes & files** — free-text notes and photo/document uploads stored in the student's folder
- **Settings** — storage folder, color themes, English / French interface

---

## Storage layout

```
<DOJO_ROOT_DIR>/
└── <Student Name>/
    ├── profile.json     # all student fields + payment history
    ├── notes.txt
    ├── photos/
    └── documents/
```

Student names are validated before being used as folder names, so a request cannot escape the
storage folder. Renaming a student renames the folder.

---

## Getting started

Requirements: **Node.js 18+**

### 1. Backend

```bash
cd dojo-backend
cp .env.example .env     # optional — defaults are fine for local use
npm install
npm start                # http://localhost:3001
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | API port | `3001` |
| `DOJO_ROOT_DIR` | Folder where student folders are stored | `dojo-backend/data` |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated, or `*` | `*` |

The storage folder can also be changed at runtime from **Settings → Storage Root**.

### 2. Frontend

```bash
cd dojo-manager
cp .env.example .env     # set VITE_API_URL if the backend is not on http://localhost:3001
npm install
npm run dev              # http://localhost:5173
```

Production build: `npm run build` (output in `dojo-manager/dist`).

---

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/students` | List all students |
| POST | `/api/student` | Create a student (folder + `profile.json`) |
| PUT | `/api/student/:name` | Update a student (renames folder if `name` changed) |
| DELETE | `/api/student/:name` | Delete a student and their folder |
| GET / POST | `/api/student/:name/note` | Read / save notes |
| POST | `/api/student/:name/upload` | Upload files (`multipart/form-data`, field `files`) |
| GET / POST | `/api/config/root` | Get / change the storage folder |

---

## Security note

The API has no authentication — it is designed to run **locally** on the dojo's computer.
Do not expose it to the internet without adding authentication in front of it.
