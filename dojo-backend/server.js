const express = require("express");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// DEFAULT ROOT FOLDER (you can change from frontend later)
let ROOT_DIR = "D:/JudoDojo";

/* ────────────────────────────────
   HELPERS
──────────────────────────────── */
function studentPath(name) {
  return path.join(ROOT_DIR, name);
}

/* ────────────────────────────────
   CREATE STUDENT FOLDER + PROFILE
──────────────────────────────── */
app.post("/api/student", async (req, res) => {
  try {
    const student = req.body;

    const folder = studentPath(student.name);

    await fs.ensureDir(folder);
    await fs.ensureDir(path.join(folder, "photos"));
    await fs.ensureDir(path.join(folder, "documents"));

    await fs.writeJson(path.join(folder, "profile.json"), student, {
      spaces: 2,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────
   GET ALL STUDENTS
──────────────────────────────── */
app.get("/api/students", async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────
   UPDATE STUDENT
──────────────────────────────── */
app.put("/api/student/:name", async (req, res) => {
  try {
    const file = path.join(studentPath(req.params.name), "profile.json");

    await fs.writeJson(file, req.body, { spaces: 2 });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────
   NOTES SYSTEM
──────────────────────────────── */
app.post("/api/student/:name/note", async (req, res) => {
  try {
    const file = path.join(studentPath(req.params.name), "notes.txt");

    await fs.writeFile(file, req.body.note, "utf8");

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/student/:name/note", async (req, res) => {
  try {
    const file = path.join(studentPath(req.params.name), "notes.txt");

    if (!(await fs.pathExists(file))) {
      return res.json({ note: "" });
    }

    const note = await fs.readFile(file, "utf8");

    res.json({ note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────
   FILE UPLOAD SYSTEM
──────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.mimetype.startsWith("image/") ? "photos" : "documents";

    const dir = path.join(studentPath(req.params.name), type);

    fs.ensureDirSync(dir);

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.post("/api/student/:name/upload", upload.array("files"), (req, res) => {
  res.json({ success: true, files: req.files });
});

/* ────────────────────────────────
   CHANGE ROOT DIRECTORY
──────────────────────────────── */
app.post("/api/config/root", (req, res) => {
  ROOT_DIR = req.body.path;
  res.json({ success: true, root: ROOT_DIR });
});

/* ────────────────────────────────
   START SERVER
──────────────────────────────── */
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
  console.log("Root:", ROOT_DIR);
});
