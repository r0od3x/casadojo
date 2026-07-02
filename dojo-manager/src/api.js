const API = "http://localhost:5000/api";

/* ─── STUDENTS ───────────────────────── */
export async function getStudents() {
  const res = await fetch(`${API}/students`);
  return res.json();
}

export async function saveStudents(data) {
  await fetch(`${API}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/* ─── NOTES ───────────────────────── */
export async function getNote(id) {
  const res = await fetch(`${API}/notes/${id}`);
  return res.json();
}

export async function saveNote(id, note) {
  await fetch(`${API}/notes/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

/* ─── FILES ───────────────────────── */
export async function getFiles(id) {
  const res = await fetch(`${API}/files/${id}`);
  return res.json();
}

export async function saveFiles(id, files) {
  await fetch(`${API}/files/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
}

export async function deleteStudentAPI(id) {
  await fetch(`${API}/students/${id}`, { method: "DELETE" });
}
