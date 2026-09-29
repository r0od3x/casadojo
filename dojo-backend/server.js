require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Folder where one sub-folder per student is stored. Can be changed at runtime from the UI.
let ROOT_DIR = path.resolve(process.env.DOJO_ROOT_DIR || path.join(__dirname, "data"));

const app = express();

app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((o) => o.trim()) }));
app.use(express.json({ limit: "10mb" }));

/* ────────────────────────────────
   HELPERS
──────────────────────────────── */

// Student names become folder names: reject anything that could escape ROOT_DIR
// or is not a valid Windows/Unix folder name.
function safeName(name) {
  const n = String(name ?? "").trim();
  if (!n || n === "." || n === ".." || /[\\/:*?"<>|\x00-\x1f]/.test(n)) {
    const err = new Error("Invalid student name");
    err.status = 400;
    throw err;
  }
  return n;
}

function studentPath(name) {
  const folder = path.resolve(ROOT_DIR, safeName(name));
  if (path.dirname(folder) !== ROOT_DIR) {
    const err = new Error("Invalid student name");
    err.status = 400;
    throw err;
  }
  return folder;
}

function sendError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

/* ────────────────────────────────
   CREATE STUDENT FOLDER + PROFILE
──────────────────────────────── */
app.post("/api/student", async (req, res) => {
  try {
    const student = req.body;
    const folder = studentPath(student.name);

    if (await fs.pathExists(path.join(folder, "profile.json"))) {
      return res.status(409).json({ error: "A student with this name already exists" });
    }

    await fs.ensureDir(path.join(folder, "photos"));
    await fs.ensureDir(path.join(folder, "documents"));
    await fs.writeJson(path.join(folder, "profile.json"), student, { spaces: 2 });

    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/* ────────────────────────────────
   GET ALL STUDENTS
──────────────────────────────── */
app.get("/api/students", async (req, res) => {
  try {
    await fs.ensureDir(ROOT_DIR);
    const folders = await fs.readdir(ROOT_DIR);
    const students = [];

    for (const folder of folders) {
      const file = path.join(ROOT_DIR, folder, "profile.json");
      if (await fs.pathExists(file)) {
        students.push(await fs.readJson(file));
      }
    }

    res.json(students);
  } catch (err) {
    sendError(res, err);
  }
});

/* ────────────────────────────────
   UPDATE STUDENT (renames the folder if the name changed)
──────────────────────────────── */
app.put("/api/student/:name", async (req, res) => {
  try {
    let folder = studentPath(req.params.name);

    if (req.body.name && req.body.name !== req.params.name) {
      const target = studentPath(req.body.name);
      if (await fs.pathExists(target)) {
        return res.status(409).json({ error: "A student with this name already exists" });
      }
      await fs.move(folder, target);
      folder = target;
    }

    await fs.ensureDir(folder);
    await fs.writeJson(path.join(folder, "profile.json"), req.body, { spaces: 2 });

    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/* ────────────────────────────────
   DELETE STUDENT
──────────────────────────────── */
app.delete("/api/student/:name", async (req, res) => {
  try {
    await fs.remove(studentPath(req.params.name));
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/* ────────────────────────────────
   NOTES SYSTEM
──────────────────────────────── */
app.post("/api/student/:name/note", async (req, res) => {
  try {
    const file = path.join(studentPath(req.params.name), "notes.txt");
    await fs.outputFile(file, String(req.body.note ?? ""), "utf8");
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/student/:name/note", async (req, res) => {
  try {
    const file = path.join(studentPath(req.params.name), "notes.txt");

    if (!(await fs.pathExists(file))) {
      return res.json({ note: "" });
    }

    res.json({ note: await fs.readFile(file, "utf8") });
  } catch (err) {
    sendError(res, err);
  }
});

/* ────────────────────────────────
   FILE UPLOAD SYSTEM
──────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const type = file.mimetype.startsWith("image/") ? "photos" : "documents";
      const dir = path.join(studentPath(req.params.name), type);
      fs.ensureDirSync(dir);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + path.basename(file.originalname));
  },
});

const upload = multer({ storage });

app.post("/api/student/:name/upload", upload.array("files"), (req, res) => {
  res.json({ success: true, files: req.files });
});

/* ────────────────────────────────
   ROOT DIRECTORY
──────────────────────────────── */
app.get("/api/config/root", (req, res) => {
  res.json({ root: ROOT_DIR });
});

app.post("/api/config/root", async (req, res) => {
  try {
    const requested = String(req.body.path ?? "").trim();
    if (!requested) {
      return res.status(400).json({ error: "Path is required" });
    }

    ROOT_DIR = path.resolve(requested);
    await fs.ensureDir(ROOT_DIR);
    res.json({ success: true, root: ROOT_DIR });
  } catch (err) {
    sendError(res, err);
  }
});

// Multer and other middleware errors
app.use((err, req, res, next) => {
  sendError(res, err);
});

/* ────────────────────────────────
   START SERVER
──────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log("Root:", ROOT_DIR);
});
