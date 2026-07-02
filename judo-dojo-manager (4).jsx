import { useState, useCallback, useMemo, useRef, useEffect } from "react";

/* ─── CONFIG ─────────────────────────────────────────────────────────────── */
const API = "http://localhost:3001";

/* ─── API LAYER ─────────────────────────────────────────────────────────── */
// All server communication is isolated here.
// The rest of the component never touches fetch() directly.

const api = {
  // Students
  getStudents: () =>
    fetch(`${API}/api/students`).then(r => r.json()),

  createStudent: (student) =>
    fetch(`${API}/api/student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(student),
    }).then(r => r.json()),

  updateStudent: (originalName, student) =>
    fetch(`${API}/api/student/${encodeURIComponent(originalName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(student),
    }).then(r => r.json()),

  deleteStudent: (name) =>
    fetch(`${API}/api/student/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }).then(r => r.json()),

  // Notes
  getNote: (name) =>
    fetch(`${API}/api/student/${encodeURIComponent(name)}/note`).then(r => r.json()),

  saveNote: (name, note) =>
    fetch(`${API}/api/student/${encodeURIComponent(name)}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }).then(r => r.json()),

  // Files
  uploadFiles: (name, fileList) => {
    const form = new FormData();
    Array.from(fileList).forEach(f => form.append("files", f));
    return fetch(`${API}/api/student/${encodeURIComponent(name)}/upload`, {
      method: "POST",
      body: form,
    }).then(r => r.json());
  },

  // Root directory
  setRootDir: (path) =>
    fetch(`${API}/api/config/root`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).then(r => r.json()),
};

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const BELTS = [
  { name: "White",  hex: "#e8e8e8", dark: false },
  { name: "Yellow", hex: "#e8c84a", dark: false },
  { name: "Orange", hex: "#e07a30", dark: false },
  { name: "Green",  hex: "#3a8f5a", dark: true  },
  { name: "Blue",   hex: "#2a5fb0", dark: true  },
  { name: "Brown",  hex: "#7a4a20", dark: true  },
  { name: "Black",  hex: "#1a1a1a", dark: true, outline: true },
];
const CLASSES = ["Baby Judo", "Junior", "Senior"];
const EMPTY = {
  name: "", age: "", birthday: "", phone: "", belt: "White",
  judoClass: "Junior", fee: "", paid: false, insured: false,
  kata: false, progress: 0, points: 0, joined: "",
};

function waURL(phone, name) {
  const msg = encodeURIComponent(
    `Bonjour ${name},\n\nNous vous rappelons que votre cotisation mensuelle n'a pas encore été réglée. Merci de procéder au paiement avant le 5 du mois.\n\nCordialement,\nVotre Dojo Judo`
  );
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`;
}

/* ─── UI PRIMITIVES ──────────────────────────────────────────────────────── */
function BeltPip({ belt, size = 18 }) {
  const b = BELTS.find(x => x.name === belt) || BELTS[0];
  return <span style={{
    display: "inline-block", width: size * 2.8, height: size * 0.55,
    background: b.hex, borderRadius: 2,
    border: b.outline ? "1px solid #555" : "none",
    verticalAlign: "middle", flexShrink: 0,
  }} />;
}
function BeltChip({ belt }) {
  const b = BELTS.find(x => x.name === belt) || BELTS[0];
  return <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    background: b.dark ? b.hex : b.hex + "22",
    color: b.dark ? "#fff" : "#1a1a1a",
    border: `1px solid ${b.hex}${b.dark ? "88" : "66"}`,
    borderRadius: 4, padding: "3px 9px 3px 7px",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  }}><BeltPip belt={belt} size={10} />{belt}</span>;
}
function ClassChip({ cls }) {
  const map = { "Baby Judo": ["#4a90b8","#0d2a3a"], "Junior": ["#7a6abf","#1e1a35"], "Senior": ["#b05a4a","#2e1510"] };
  const [fg, bg] = map[cls] || ["#888","#222"];
  return <span style={{
    display: "inline-block", background: bg, color: fg,
    border: `1px solid ${fg}66`, borderRadius: 4,
    padding: "3px 9px", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase",
  }}>{cls}</span>;
}
function StatusDot({ on, label }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span style={{
      width: 7, height: 7, borderRadius: "50%",
      background: on ? "#3db870" : "#c04040",
      boxShadow: `0 0 5px ${on ? "#3db870" : "#c04040"}99`,
      display: "inline-block", flexShrink: 0,
    }} />
    <span style={{ fontSize: 12, color: on ? "#5dba7d" : "#c47070" }}>{label}</span>
  </span>;
}
function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 85 ? "#e8c84a" : pct >= 50 ? "#c0392b" : "#5a7a9a";
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div style={{ flex: 1, height: 5, background: "#252525", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s ease" }} />
    </div>
    <span style={{ fontSize: 11, color: "#666", fontVariantNumeric: "tabular-nums", minWidth: 30, textAlign: "right" }}>{pct}/100</span>
  </div>;
}
function Pill({ on, onClick, label, activeColor = "#c0392b" }) {
  return <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 8,
    background: on ? activeColor + "18" : "#1c1c1c",
    border: `1px solid ${on ? activeColor + "88" : "#303030"}`,
    borderRadius: 6, padding: "6px 14px", cursor: "pointer",
    transition: "all .18s", color: on ? activeColor : "#555",
    fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", fontFamily: "inherit",
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: on ? activeColor : "#404040",
      display: "inline-block", flexShrink: 0, transition: "background .18s",
    }} />
    {label}
  </button>;
}

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function Toast({ message, type }) {
  if (!message) return null;
  const color = type === "error" ? "#c04040" : type === "warn" ? "#c08040" : "#3a9a60";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: "#141414", border: `1px solid ${color}66`,
      borderRadius: 8, padding: "11px 18px",
      fontSize: 12, color: "#d0d0d0", fontFamily: "'DM Mono', monospace",
      boxShadow: "0 8px 32px rgba(0,0,0,.6)",
      display: "flex", alignItems: "center", gap: 10,
      animation: "fadeIn .2s ease",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {message}
    </div>
  );
}

/* ─── MODAL ──────────────────────────────────────────────────────────────── */
function Modal({ open, onClose, width = 560, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.78)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 900, backdropFilter: "blur(6px)", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#141414", border: "1px solid #252525", borderRadius: 14,
        width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 40px 100px rgba(0,0,0,.9)",
      }}>{children}</div>
    </div>
  );
}

/* ─── STUDENT FORM ───────────────────────────────────────────────────────── */
function StudentForm({ initial, onSave, onCancel, saving }) {
  const frozen = useRef({ ...EMPTY, ...initial }).current;
  const [f, setF] = useState(frozen);

  const inp = {
    background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6,
    color: "#e0e0e0", padding: "9px 12px", fontSize: 13, outline: "none",
    width: "100%", fontFamily: "inherit", transition: "border-color .15s",
  };
  const lbl = {
    display: "block", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "#505050", marginBottom: 6,
  };
  const Field = ({ label, children, span }) => (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 32 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid #1e1e1e",
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#d0d0d0", fontFamily: "'Cormorant Garamond', serif" }}>
            {frozen.name ? "Edit Student Profile" : "New Student"}
          </div>
          {frozen.name && <div style={{ fontSize: 12, color: "#505050", marginTop: 2 }}>{frozen.name}</div>}
        </div>
        <button onClick={onCancel} style={{
          background: "none", border: "1px solid #252525", color: "#505050",
          borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>&#x2715;</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 20px", marginBottom: 20 }}>
        <Field label="Full Name" span>
          <input style={inp} value={f.name}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, name: v })); }}
            placeholder="Ahmed Benali" />
        </Field>
        <Field label="Age">
          <input style={inp} type="number" value={f.age}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, age: v })); }}
            placeholder="20" min={3} max={80} />
        </Field>
        <Field label="Birthday">
          <input style={inp} type="date" value={f.birthday}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, birthday: v })); }} />
        </Field>
        <Field label="Phone (WhatsApp)">
          <input style={inp} value={f.phone}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, phone: v })); }}
            placeholder="+212600000000" />
        </Field>
        <Field label="Join Date">
          <input style={inp} type="date" value={f.joined}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, joined: v })); }} />
        </Field>
        <Field label="Subscription Fee (MAD)">
          <input style={inp} type="number" value={f.fee}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, fee: v })); }}
            placeholder="250" min={0} />
        </Field>
        <Field label="Belt">
          <select style={{ ...inp, cursor: "pointer" }} value={f.belt}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, belt: v })); }}>
            {BELTS.map(b => <option key={b.name} value={b.name}>{b.name} Belt</option>)}
          </select>
        </Field>
        <Field label="Class">
          <select style={{ ...inp, cursor: "pointer" }} value={f.judoClass}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, judoClass: v })); }}>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Points">
          <input style={inp} type="number" value={f.points}
            onChange={e => { const v = e.target.value; setF(p => ({ ...p, points: v })); }}
            min={0} max={9999} />
        </Field>
        <Field label="Black Belt Progress (0 – 100)">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={0} max={100} value={f.progress}
              onChange={e => { const v = Number(e.target.value); setF(p => ({ ...p, progress: v })); }}
              style={{ flex: 1, accentColor: "#c0392b" }} />
            <span style={{ color: "#e8c84a", fontWeight: 700, fontSize: 15, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.progress}</span>
          </div>
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "16px 0", borderTop: "1px solid #1e1e1e", borderBottom: "1px solid #1e1e1e", marginBottom: 24 }}>
        <Pill on={f.paid}    onClick={() => setF(p => ({ ...p, paid:    !p.paid    }))} label="Paid"      activeColor="#3a9a60" />
        <Pill on={f.insured} onClick={() => setF(p => ({ ...p, insured: !p.insured }))} label="Insured"   activeColor="#3a7abf" />
        <Pill on={f.kata}    onClick={() => setF(p => ({ ...p, kata:    !p.kata    }))} label="Kata Exam" activeColor="#8a4abf" />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} disabled={saving} style={{
          background: "none", border: "1px solid #2a2a2a", color: "#707070",
          borderRadius: 6, padding: "9px 22px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
          opacity: saving ? 0.5 : 1,
        }}>Cancel</button>
        <button onClick={() => onSave(f)} disabled={saving} style={{
          background: saving ? "#7a2020" : "#c0392b", border: "none", color: "#fff",
          borderRadius: 6, padding: "9px 28px", cursor: saving ? "wait" : "pointer",
          fontWeight: 700, fontSize: 13, fontFamily: "inherit", letterSpacing: "0.04em",
          transition: "background .2s", minWidth: 80,
        }}>{saving ? "Saving..." : "Save"}</button>
      </div>
    </div>
  );
}

/* ─── DETAIL PANEL ───────────────────────────────────────────────────────── */
function DetailPanel({ student: s, onClose, onEdit, onDelete, onToggle, onProgress, notifSent, onNotif, onFileUploaded }) {
  const [note,        setNote]        = useState("");
  const [noteStatus,  setNoteStatus]  = useState("idle"); // idle | saving | saved | error
  const [noteLoaded,  setNoteLoaded]  = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading,   setUploading]   = useState(false);
  const [activeTab,   setActiveTab]   = useState("info");
  const fileInputRef  = useRef(null);
  const noteTimer     = useRef(null);

  // Reload note whenever student changes
  useEffect(() => {
    setNoteLoaded(false);
    setNote("");
    api.getNote(s.name).then(res => {
      setNote(res.note ?? "");
      setNoteLoaded(true);
    }).catch(() => setNoteLoaded(true));
  }, [s.name]);

  // Debounced note save — writes to notes.txt on server
  function handleNoteChange(val) {
    setNote(val);
    setNoteStatus("saving");
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      try {
        await api.saveNote(s.name, val);
        setNoteStatus("saved");
        setTimeout(() => setNoteStatus("idle"), 2000);
      } catch {
        setNoteStatus("error");
      }
    }, 600);
  }

  // File upload — sent to server as multipart, stored in photos/ or documents/
  async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    try {
      const res = await api.uploadFiles(s.name, files);
      if (res.files) {
        setUploadedFiles(prev => [...prev, ...res.files]);
        if (onFileUploaded) onFileUploaded();
      }
    } catch {
      // upload failed silently — toast handled at app level if needed
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function formatBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  }
  function fileIcon(name = "") {
    const ext = name.split(".").pop().toLowerCase();
    if (["jpg","jpeg","png","gif","webp","bmp"].includes(ext)) return "▣";
    if (ext === "pdf") return "▤";
    if (["doc","docx"].includes(ext)) return "▦";
    return "▢";
  }

  const noteStatusColor = { idle: "#303030", saving: "#e8c84a", saved: "#3a9a60", error: "#c04040" };
  const noteStatusLabel = { idle: "", saving: "saving...", saved: "saved to server", error: "save failed" };

  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ fontSize: 11, color: "#505050", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#c0c0c0" }}>{value}</span>
    </div>
  );
  const tabBtn = (id, label) => (
    <button onClick={() => setActiveTab(id)} style={{
      background: activeTab === id ? "#1a1a1a" : "none",
      border: "none", borderBottom: `2px solid ${activeTab === id ? "#c0392b" : "transparent"}`,
      color: activeTab === id ? "#d0d0d0" : "#505050",
      padding: "8px 14px", cursor: "pointer", fontSize: 11,
      fontWeight: 700, letterSpacing: "0.08em", fontFamily: "inherit",
      textTransform: "uppercase", transition: "all .15s",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 0", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e0e0e0", fontFamily: "'Cormorant Garamond', serif" }}>{s.name}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <BeltChip belt={s.belt} /><ClassChip cls={s.judoClass} />
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #252525", color: "#505050",
            borderRadius: 6, width: 30, height: 30, cursor: "pointer", fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>&#x2715;</button>
        </div>
        <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
          {tabBtn("info",  "Info")}
          {tabBtn("notes", "Notes")}
          {tabBtn("files", "Files")}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

        {/* INFO TAB */}
        {activeTab === "info" && (<>
          <div style={{ marginBottom: 20 }}>
            {row("Age", `${s.age} years old`)}
            {row("Birthday", s.birthday ? new Date(s.birthday + "T00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—")}
            {row("Phone", s.phone)}
            {row("Member since", s.joined ? new Date(s.joined + "T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "—")}
            {row("Subscription Fee", `MAD ${s.fee}`)}
            {row("Points", s.points)}
          </div>

          <div style={{ marginBottom: 20, padding: "14px 16px", background: "#0f0f0f", borderRadius: 8, border: "1px solid #1e1e1e" }}>
            <div style={{ fontSize: 10, color: "#505050", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Black Belt Progression</div>
            <ProgressBar value={s.progress} />
            <input type="range" min={0} max={100} value={s.progress}
              onChange={e => onProgress("progress", Number(e.target.value))}
              style={{ width: "100%", marginTop: 8, accentColor: "#c0392b" }} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <Pill on={s.paid}    onClick={() => onToggle("paid")}    label="Paid"      activeColor="#3a9a60" />
            <Pill on={s.insured} onClick={() => onToggle("insured")} label="Insured"   activeColor="#3a7abf" />
            <Pill on={s.kata}    onClick={() => onToggle("kata")}    label="Kata Exam" activeColor="#8a4abf" />
          </div>

          {!s.paid && (
            <a href={waURL(s.phone, s.name)} target="_blank" rel="noopener noreferrer" onClick={onNotif}
              style={{
                display: "block", textAlign: "center",
                background: notifSent ? "#1a2e1a" : "#128C7E",
                color: notifSent ? "#4a9a4a" : "#fff",
                borderRadius: 6, padding: "11px", fontWeight: 700, fontSize: 12,
                textDecoration: "none", marginBottom: 16, letterSpacing: "0.04em",
                border: `1px solid ${notifSent ? "#2a4a2a" : "#128C7E"}`, transition: "all .2s",
              }}>
              {notifSent ? "Reminder sent" : "Send WhatsApp payment reminder"}
            </a>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onEdit} style={{
              flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a",
              color: "#b0b0b0", borderRadius: 6, padding: 10,
              cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
            }}>Edit Profile</button>
            <button onClick={onDelete} style={{
              background: "#1e1010", border: "1px solid #3a2020", color: "#c07070",
              borderRadius: 6, padding: "10px 18px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
            }}>Delete</button>
          </div>
        </>)}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#505050", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Student Notes</div>
              <div style={{ fontSize: 10, color: noteStatusColor[noteStatus], transition: "color .3s" }}>
                {noteStatusLabel[noteStatus]}
              </div>
            </div>
            {!noteLoaded ? (
              <div style={{ color: "#404040", fontSize: 12, padding: "20px 0" }}>Fetching from server...</div>
            ) : (
              <textarea
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder={`Notes about ${s.name}...\n\nTraining observations, medical notes, competition results, etc.`}
                style={{
                  width: "100%", minHeight: 280,
                  background: "#0f0f0f", border: "1px solid #2a2a2a",
                  borderRadius: 8, color: "#c8c8c8",
                  padding: "14px", fontSize: 13, lineHeight: 1.7,
                  resize: "vertical", outline: "none",
                  fontFamily: "'DM Mono', monospace", boxSizing: "border-box",
                }}
              />
            )}
            <div style={{ fontSize: 10, color: "#303030", marginTop: 8 }}>
              Saved to <code style={{ color: "#404040" }}>{s.name}/notes.txt</code> on the server.
            </div>
          </div>
        )}

        {/* FILES TAB */}
        {activeTab === "files" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#505050", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Student Files</div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
                background: "#1a1a1a", border: "1px solid #2a2a2a", color: uploading ? "#404040" : "#909090",
                borderRadius: 5, padding: "6px 14px", cursor: uploading ? "wait" : "pointer",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "inherit",
              }}>{uploading ? "Uploading..." : "+ Upload"}</button>
            </div>

            <input
              ref={fileInputRef} type="file" multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />

            {uploadedFiles.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1px dashed #252525", borderRadius: 8,
                  padding: "40px 20px", textAlign: "center", cursor: "pointer",
                  color: "#404040", fontSize: 12, lineHeight: 2,
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 8, color: "#303030" }}>&#x2B06;</div>
                Click to upload photos or documents<br />
                <span style={{ fontSize: 11, color: "#303030" }}>
                  Stored in <code>{s.name}/photos/</code> or <code>{s.name}/documents/</code>
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {uploadedFiles.map((file, i) => (
                  <div key={i} style={{
                    background: "#0f0f0f", border: "1px solid #1e1e1e",
                    borderRadius: 6, padding: "10px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 38, height: 38, background: "#1a1a1a",
                      border: "1px solid #252525", borderRadius: 4,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, color: "#505050", flexShrink: 0,
                    }}>{fileIcon(file.originalname || file.filename)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#c0c0c0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {file.originalname || file.filename}
                      </div>
                      <div style={{ fontSize: 10, color: "#404040", marginTop: 2 }}>
                        {formatBytes(file.size)} &middot; {file.mimetype?.startsWith("image/") ? "photos/" : "documents/"}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} style={{
                  background: "none", border: "1px dashed #252525", color: "#404040",
                  borderRadius: 6, padding: "10px", cursor: "pointer",
                  fontSize: 11, fontFamily: "inherit", marginTop: 4,
                }}>+ Add more files</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [students,    setStudents]    = useState([]);
  const [loadState,   setLoadState]   = useState("loading"); // loading | ok | error
  const [rootDir,     setRootDir]     = useState("D:/JudoDojo");
  const [dirEditing,  setDirEditing]  = useState(false);
  const [dirDraft,    setDirDraft]    = useState("");
  const [search,      setSearch]      = useState("");
  const [beltFilter,  setBeltFilter]  = useState("All");
  const [paidFilter,  setPaidFilter]  = useState("All");
  const [classFilter, setClassFilter] = useState("All");
  const [tab,         setTab]         = useState("roster");
  const [formOpen,    setFormOpen]    = useState(false);
  const [formInit,    setFormInit]    = useState(null);
  const [formKey,     setFormKey]     = useState(0);
  const [formSaving,  setFormSaving]  = useState(false);
  const [selectedId,  setSelectedId]  = useState(null); // actually student name
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [notifSent,   setNotifSent]   = useState({});
  const [toast,       setToast]       = useState({ message: "", type: "ok" });

  const today = new Date();
  const isAfter5th = today.getDate() >= 5;

  function showToast(message, type = "ok", duration = 3000) {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "ok" }), duration);
  }

  /* ── Load students from server on mount ── */
  async function loadStudents() {
    setLoadState("loading");
    try {
      const data = await api.getStudents();
      setStudents(Array.isArray(data) ? data : []);
      setLoadState("ok");
    } catch {
      setLoadState("error");
    }
  }
  useEffect(() => { loadStudents(); }, []);

  /* ── Save / Create ── */
  const saveStudent = useCallback(async (f) => {
    if (!f.name.trim()) { showToast("Name is required.", "error"); return; }
    setFormSaving(true);
    const student = {
      ...f,
      age: Number(f.age), fee: Number(f.fee),
      progress: Number(f.progress), points: Number(f.points),
    };
    try {
      if (formInit?.name) {
        // Edit: use original name as path key (handles renames gracefully)
        await api.updateStudent(formInit.name, student);
        setStudents(ss => ss.map(s => s.name === formInit.name ? student : s));
        // If renamed, update selectedId
        if (selectedId === formInit.name) setSelectedId(student.name);
        showToast("Profile updated.");
      } else {
        // Create: server makes the folder and profile.json
        await api.createStudent(student);
        setStudents(ss => [...ss, student]);
        setSelectedId(student.name);
        showToast("Student created — folder ready on server.");
      }
      setFormOpen(false);
    } catch (err) {
      showToast("Server error — could not save.", "error");
    } finally {
      setFormSaving(false);
    }
  }, [formInit, selectedId]);

  /* ── Delete ── */
  const deleteStudent = useCallback(async (name) => {
    setDeleting(true);
    try {
      await api.deleteStudent(name);
      setStudents(ss => ss.filter(s => s.name !== name));
      setDeleteTarget(null);
      if (selectedId === name) setSelectedId(null);
      showToast("Student and folder removed.");
    } catch {
      showToast("Server error — could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }, [selectedId]);

  /* ── Toggle a boolean field + persist ── */
  const toggleField = useCallback(async (name, field) => {
    setStudents(ss => {
      const updated = ss.map(s => s.name === name ? { ...s, [field]: !s[field] } : s);
      const student = updated.find(s => s.name === name);
      if (student) api.updateStudent(name, student).catch(() => showToast("Sync error.", "warn"));
      return updated;
    });
  }, []);

  /* ── Update progress slider + persist (debounced) ── */
  const progressTimer = useRef(null);
  const setProgress = useCallback((name, field, val) => {
    setStudents(ss => ss.map(s => s.name === name ? { ...s, [field]: val } : s));
    clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(async () => {
      setStudents(ss => {
        const student = ss.find(s => s.name === name);
        if (student) api.updateStudent(name, student).catch(() => showToast("Sync error.", "warn"));
        return ss;
      });
    }, 500);
  }, []);

  /* ── Change root directory ── */
  async function applyRootDir(path) {
    try {
      await api.setRootDir(path);
      setRootDir(path);
      setDirEditing(false);
      showToast(`Root set to ${path}`);
      await loadStudents(); // reload from new location
    } catch {
      showToast("Could not update root directory.", "error");
    }
  }

  /* ── Derived ── */
  const filtered = useMemo(() => students.filter(s => {
    const q = search.toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || (s.phone || "").includes(q))
      && (beltFilter  === "All" || s.belt      === beltFilter)
      && (paidFilter  === "All" || (paidFilter === "Paid" ? s.paid : !s.paid))
      && (classFilter === "All" || s.judoClass === classFilter);
  }), [students, search, beltFilter, paidFilter, classFilter]);

  const selected = students.find(s => s.name === selectedId) || null;
  const unpaid   = students.filter(s => !s.paid);
  const stats    = useMemo(() => ({
    total:   students.length,
    paid:    students.filter(s => s.paid).length,
    insured: students.filter(s => s.insured).length,
    kata:    students.filter(s => s.kata).length,
    revenue: students.filter(s => s.paid).reduce((a, s) => a + Number(s.fee), 0),
    avgProg: students.length ? Math.round(students.reduce((a, s) => a + s.progress, 0) / students.length) : 0,
  }), [students]);

  function openNewForm() {
    setFormInit(null);
    setFormKey(k => k + 1);
    setFormOpen(true);
  }
  function openEditForm(s) {
    setFormInit(s);
    setFormKey(k => k + 1);
    setFormOpen(true);
  }

  /* ── Shared styles ── */
  const inp = {
    background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 5,
    color: "#d0d0d0", padding: "7px 10px", fontSize: 12, outline: "none",
    fontFamily: "inherit",
  };
  const navItem = (label, id) => (
    <button key={id} onClick={() => setTab(id)} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "10px 24px", background: tab === id ? "#161616" : "none",
      border: "none", borderLeft: `2px solid ${tab === id ? "#c0392b" : "transparent"}`,
      color: tab === id ? "#e0e0e0" : "#505050",
      cursor: "pointer", fontSize: 12, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      fontFamily: "inherit", transition: "all .15s",
    }}>{label}</button>
  );
  const filterSel = (val, set, options) => (
    <select value={val} onChange={e => set(e.target.value)} style={{ ...inp, cursor: "pointer", color: "#909090" }}>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );

  /* ── Render ── */
  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", color: "#d0d0d0", fontFamily: "'DM Mono', 'Consolas', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #252525; border-radius: 2px; }
        input, select, textarea { color-scheme: dark; }
        input:focus, select:focus, textarea:focus { border-color: #404040 !important; }
        .trow { transition: background .12s; cursor: pointer; }
        .trow:hover { background: #141414 !important; }
        .trow.sel { background: #161616 !important; border-left: 2px solid #c0392b !important; }
        button:active { opacity: .8; }
        a:active { opacity: .8; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        code { font-family: inherit; }
      `}</style>

      {/* HEADER */}
      <div style={{
        height: 56, background: "#0c0c0c", borderBottom: "1px solid #1c1c1c",
        display: "flex", alignItems: "center", padding: "0 28px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, color: "#d0d0d0", letterSpacing: 0.5, marginRight: "auto" }}>
          Judo Dojo &mdash; <span style={{ color: "#505050", fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 400 }}>Management System</span>
        </div>
        {/* Server status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 20 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", display: "inline-block",
            background: loadState === "ok" ? "#3db870" : loadState === "loading" ? "#e8c84a" : "#c04040",
          }} />
          <span style={{ fontSize: 10, color: "#404040", letterSpacing: "0.08em" }}>
            {loadState === "ok" ? "SERVER CONNECTED" : loadState === "loading" ? "CONNECTING..." : "SERVER OFFLINE"}
          </span>
          {loadState === "error" && (
            <button onClick={loadStudents} style={{
              background: "none", border: "1px solid #2a2a2a", color: "#707070",
              borderRadius: 4, padding: "3px 10px", cursor: "pointer",
              fontSize: 10, fontFamily: "inherit", marginLeft: 4,
            }}>Retry</button>
          )}
        </div>
        {isAfter5th && unpaid.length > 0 && (
          <div style={{
            background: "#1e0f0f", border: "1px solid #c0392b44", borderRadius: 5,
            padding: "5px 14px", fontSize: 11, color: "#c07070",
            fontWeight: 700, letterSpacing: "0.06em", marginRight: 14,
          }}>{unpaid.length} UNPAID — PAST 5TH</div>
        )}
        <button onClick={openNewForm} style={{
          background: "#c0392b", border: "none", color: "#fff", borderRadius: 6,
          padding: "8px 18px", cursor: "pointer", fontWeight: 700,
          fontSize: 12, letterSpacing: "0.06em", fontFamily: "inherit",
        }}>+ NEW STUDENT</button>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>

        {/* SIDEBAR */}
        <div style={{
          width: 220, flexShrink: 0, background: "#0e0e0e",
          borderRight: "1px solid #1c1c1c", padding: "20px 0",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          <div style={{ padding: "0 24px 16px", fontSize: 10, color: "#353535", fontWeight: 700, letterSpacing: "0.12em" }}>NAVIGATION</div>
          {navItem("Roster",    "roster")}
          {navItem("Dashboard", "dashboard")}

          <div style={{ marginTop: 28, padding: "0 24px 12px", fontSize: 10, color: "#353535", fontWeight: 700, letterSpacing: "0.12em" }}>QUICK STATS</div>
          {[["Students", stats.total], ["Paid", `${stats.paid}/${stats.total}`], ["Insured", stats.insured], ["Kata", stats.kata]].map(([l, v]) => (
            <div key={l} style={{ padding: "8px 24px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#404040" }}>{l}</span>
              <span style={{ fontSize: 12, color: "#707070", fontWeight: 600 }}>{v}</span>
            </div>
          ))}

          {/* Root directory control */}
          <div style={{ marginTop: 28, padding: "0 24px 12px", fontSize: 10, color: "#353535", fontWeight: 700, letterSpacing: "0.12em" }}>STORAGE ROOT</div>
          <div style={{ padding: "0 16px 16px" }}>
            {dirEditing ? (
              <div>
                <input
                  value={dirDraft}
                  onChange={e => setDirDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") applyRootDir(dirDraft);
                    if (e.key === "Escape") setDirEditing(false);
                  }}
                  autoFocus
                  style={{ ...inp, width: "100%", fontSize: 10, padding: "6px 8px", marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => applyRootDir(dirDraft)} style={{
                    flex: 1, background: "#c0392b", border: "none", color: "#fff",
                    borderRadius: 4, padding: "5px 0", cursor: "pointer",
                    fontSize: 10, fontFamily: "inherit", fontWeight: 700,
                  }}>Apply</button>
                  <button onClick={() => setDirEditing(false)} style={{
                    flex: 1, background: "none", border: "1px solid #2a2a2a", color: "#606060",
                    borderRadius: 4, padding: "5px 0", cursor: "pointer",
                    fontSize: 10, fontFamily: "inherit",
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setDirDraft(rootDir); setDirEditing(true); }} style={{
                background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 5,
                padding: "8px 10px", width: "100%", textAlign: "left",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                <div style={{ fontSize: 9, color: "#404040", letterSpacing: "0.08em", marginBottom: 4 }}>FOLDER ROOT</div>
                <div style={{ fontSize: 10, color: "#606060", wordBreak: "break-all" }}>{rootDir}</div>
                <div style={{ fontSize: 9, color: "#353535", marginTop: 4 }}>Click to change</div>
              </button>
            )}
            <div style={{ marginTop: 8, fontSize: 9, color: "#303030", lineHeight: 1.5 }}>
              Each student has a dedicated folder on the server. Notes and files persist there.
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: "16px 24px", borderTop: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 10, color: "#353535", marginBottom: 4, letterSpacing: "0.08em" }}>MONTHLY REVENUE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e0e0e0", fontFamily: "'Cormorant Garamond', serif" }}>
              MAD {stats.revenue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>

          {/* Loading / Error states */}
          {loadState === "loading" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", color: "#404040", fontSize: 13, letterSpacing: "0.1em" }}>
              Fetching students from server...
            </div>
          )}

          {loadState === "error" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 16, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#c07070" }}>Cannot reach the backend server.</div>
              <div style={{ fontSize: 11, color: "#505050", lineHeight: 1.8 }}>
                Make sure the backend is running on <code style={{ color: "#707070" }}>localhost:3001</code><br />
                Run: <code style={{ color: "#707070" }}>node server.js</code> in the dojo-backend folder
              </div>
              <button onClick={loadStudents} style={{
                background: "#c0392b", border: "none", color: "#fff", borderRadius: 6,
                padding: "9px 24px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
              }}>Retry Connection</button>
            </div>
          )}

          {/* ROSTER */}
          {loadState === "ok" && tab === "roster" && (<>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                <input
                  placeholder="Search name or phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...inp, width: "100%", padding: "8px 12px" }}
                />
              </div>
              {filterSel(beltFilter,  setBeltFilter,  [{ value: "All", label: "All Belts"    }, ...BELTS.map(b => ({ value: b.name, label: b.name }))])}
              {filterSel(paidFilter,  setPaidFilter,  [{ value: "All", label: "All Status"   }, { value: "Paid", label: "Paid" }, { value: "Unpaid", label: "Unpaid" }])}
              {filterSel(classFilter, setClassFilter, [{ value: "All", label: "All Classes"  }, ...CLASSES.map(c => ({ value: c, label: c }))])}
              <span style={{ fontSize: 11, color: "#404040", marginLeft: "auto" }}>{filtered.length} {filtered.length === 1 ? "student" : "students"}</span>
            </div>

            <div style={{ border: "1px solid #1c1c1c", borderRadius: 8, overflow: "hidden", background: "#0e0e0e" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0a0a0a", borderBottom: "1px solid #1c1c1c" }}>
                    {["Student", "Class", "Belt", "Progress", "Paid", "Insured", "Kata", "Fee"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 10, color: "#404040", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderRight: "1px solid #141414" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#303030", fontSize: 13 }}>No students match current filters</td></tr>
                  )}
                  {filtered.map(s => (
                    <tr
                      key={s.name}
                      className={`trow${selectedId === s.name ? " sel" : ""}`}
                      onClick={() => setSelectedId(s.name === selectedId ? null : s.name)}
                      style={{ borderBottom: "1px solid #141414", borderLeft: selectedId === s.name ? "2px solid #c0392b" : "2px solid transparent" }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#c8c8c8", fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#404040", marginTop: 1 }}>Age {s.age}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}><ClassChip cls={s.judoClass} /></td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BeltPip belt={s.belt} size={13} />
                          <span style={{ fontSize: 12, color: "#707070" }}>{s.belt}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", minWidth: 120 }}><ProgressBar value={s.progress} /></td>
                      <td style={{ padding: "12px 14px" }} onClick={e => { e.stopPropagation(); toggleField(s.name, "paid"); }}>
                        <StatusDot on={s.paid} label={s.paid ? "Paid" : "Unpaid"} />
                      </td>
                      <td style={{ padding: "12px 14px" }} onClick={e => { e.stopPropagation(); toggleField(s.name, "insured"); }}>
                        <StatusDot on={s.insured} label={s.insured ? "Yes" : "No"} />
                      </td>
                      <td style={{ padding: "12px 14px" }} onClick={e => { e.stopPropagation(); toggleField(s.name, "kata"); }}>
                        <StatusDot on={s.kata} label={s.kata ? "Pass" : "—"} />
                      </td>
                      <td style={{ padding: "12px 14px", color: "#707070", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                        MAD {s.fee}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* DASHBOARD */}
          {loadState === "ok" && tab === "dashboard" && (<>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: "#c0c0c0", marginBottom: 24, fontWeight: 700 }}>Dojo Overview</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total Members",    value: stats.total,                   sub: "active" },
                { label: "Paid This Month",  value: `${stats.paid}/${stats.total}`, sub: `MAD ${stats.revenue.toLocaleString()}` },
                { label: "Insured",          value: stats.insured,                 sub: `${stats.total - stats.insured} uninsured` },
                { label: "Kata Certified",   value: stats.kata,                    sub: "passed exam" },
                { label: "Avg. BB Progress", value: `${stats.avgProg}%`,           sub: "toward black belt" },
                { label: "Unpaid",           value: unpaid.length,                 sub: isAfter5th ? "past due" : "within grace period", alert: unpaid.length > 0 && isAfter5th },
              ].map(c => (
                <div key={c.label} style={{ background: c.alert ? "#180d0d" : "#0e0e0e", border: `1px solid ${c.alert ? "#3a1515" : "#1c1c1c"}`, borderRadius: 8, padding: "20px 22px" }}>
                  <div style={{ fontSize: 10, color: c.alert ? "#7a4040" : "#404040", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{c.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: c.alert ? "#c07070" : "#d0d0d0", fontFamily: "'Cormorant Garamond', serif" }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: c.alert ? "#7a4040" : "#404040", marginTop: 4 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", borderRadius: 8, padding: "20px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#404040", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Belt Distribution</div>
              <div style={{ display: "flex", gap: 2, height: 28, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
                {BELTS.map(b => {
                  const count = students.filter(s => s.belt === b.name).length;
                  if (!count) return null;
                  return <div key={b.name} style={{ flex: count, background: b.hex, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: b.dark ? "#fff" : "#1a1a1a", minWidth: 0, overflow: "hidden" }}>{count}</div>;
                })}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {BELTS.map(b => (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <BeltPip belt={b.name} size={10} />
                    <span style={{ fontSize: 11, color: "#505050" }}>{b.name} ({students.filter(s => s.belt === b.name).length})</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", borderRadius: 8, padding: "20px 22px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#404040", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Class Distribution</div>
              <div style={{ display: "flex", gap: 14 }}>
                {CLASSES.map(cls => (
                  <div key={cls} style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1c1c1c", borderRadius: 6, padding: "16px" }}>
                    <ClassChip cls={cls} />
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#c0c0c0", fontFamily: "'Cormorant Garamond', serif", marginTop: 10 }}>{students.filter(s => s.judoClass === cls).length}</div>
                    <div style={{ fontSize: 11, color: "#404040", marginTop: 2 }}>students</div>
                  </div>
                ))}
              </div>
            </div>

            {unpaid.length > 0 && (
              <div style={{ background: "#100a0a", border: "1px solid #2a1515", borderRadius: 8, padding: "20px 22px" }}>
                <div style={{ fontSize: 10, color: "#7a4040", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                  Unpaid Subscriptions {isAfter5th ? "— Action Required" : "— Grace Period"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {unpaid.map(s => (
                    <div key={s.name} style={{ background: "#0f0a0a", border: "1px solid #251515", borderRadius: 6, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#c0c0c0", fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#504040", marginTop: 2 }}>{s.phone} &middot; {s.judoClass} &middot; MAD {s.fee}</div>
                      </div>
                      <a href={waURL(s.phone, s.name)} target="_blank" rel="noopener noreferrer"
                        onClick={() => setNotifSent(n => ({ ...n, [s.name]: true }))}
                        style={{
                          background: notifSent[s.name] ? "#1a2e1a" : "#128C7E",
                          color: notifSent[s.name] ? "#4a9a4a" : "#fff",
                          borderRadius: 5, padding: "7px 16px", fontWeight: 700, fontSize: 11,
                          textDecoration: "none", whiteSpace: "nowrap", letterSpacing: "0.05em",
                          border: "1px solid transparent", transition: "all .2s",
                        }}>
                        {notifSent[s.name] ? "Sent" : "WhatsApp Reminder"}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div style={{ width: 360, flexShrink: 0, background: "#0e0e0e", borderLeft: "1px solid #1c1c1c", overflowY: "auto" }}>
            <DetailPanel
              key={selected.name}
              student={selected}
              onClose={() => setSelectedId(null)}
              onEdit={() => openEditForm(selected)}
              onDelete={() => setDeleteTarget(selected.name)}
              onToggle={field => toggleField(selected.name, field)}
              onProgress={(field, val) => setProgress(selected.name, field, val)}
              notifSent={notifSent[selected.name]}
              onNotif={() => setNotifSent(n => ({ ...n, [selected.name]: true }))}
            />
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <Modal open={formOpen} onClose={() => !formSaving && setFormOpen(false)} width={580}>
        <StudentForm
          key={formKey}
          initial={formInit}
          onSave={saveStudent}
          onCancel={() => setFormOpen(false)}
          saving={formSaving}
        />
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} width={400}>
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#c07070", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12 }}>CONFIRM DELETE</div>
          <div style={{ color: "#707070", fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
            The student profile, notes, and all uploaded files for
          </div>
          <div style={{ color: "#d0d0d0", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{deleteTarget}</div>
          <div style={{ color: "#707070", fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
            will be permanently removed from the server.<br />This action cannot be undone.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
              background: "none", border: "1px solid #2a2a2a", color: "#707070",
              borderRadius: 6, padding: "9px 24px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              opacity: deleting ? 0.5 : 1,
            }}>Cancel</button>
            <button onClick={() => deleteStudent(deleteTarget)} disabled={deleting} style={{
              background: deleting ? "#7a2020" : "#c0392b", border: "none", color: "#fff",
              borderRadius: 6, padding: "9px 28px", cursor: deleting ? "wait" : "pointer",
              fontWeight: 700, fontSize: 13, fontFamily: "inherit", minWidth: 80,
            }}>{deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </Modal>

      {/* TOAST */}
      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}
