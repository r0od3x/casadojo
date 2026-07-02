import { useState, useCallback, useMemo, useRef, useEffect, createContext, useContext } from "react";

/* ─── API ────────────────────────────────────────────────────────────────── */
const API = "http://localhost:3001";
const api = {
  getStudents:    ()           => fetch(`${API}/api/students`).then(r => r.json()),
  createStudent:  (s)          => fetch(`${API}/api/student`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(s) }).then(r=>r.json()),
  updateStudent:  (orig, s)    => fetch(`${API}/api/student/${encodeURIComponent(orig)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(s) }).then(r=>r.json()),
  deleteStudent:  (name)       => fetch(`${API}/api/student/${encodeURIComponent(name)}`, { method:"DELETE" }).then(r=>r.json()),
  getNote:        (name)       => fetch(`${API}/api/student/${encodeURIComponent(name)}/note`).then(r=>r.json()),
  saveNote:       (name, note) => fetch(`${API}/api/student/${encodeURIComponent(name)}/note`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({note}) }).then(r=>r.json()),
  uploadFiles:    (name, list) => { const fd=new FormData(); Array.from(list).forEach(f=>fd.append("files",f)); return fetch(`${API}/api/student/${encodeURIComponent(name)}/upload`,{method:"POST",body:fd}).then(r=>r.json()); },
  setRootDir:     (path)       => fetch(`${API}/api/config/root`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({path}) }).then(r=>r.json()),
};

/* ─── RECEIPT HELPERS ────────────────────────────────────────────────────── */
// Payments are stored inside profile.json as student.payments[]
// Each entry: { id, month:"YYYY-MM", date:"YYYY-MM-DD", amount, paid, receiptNo, mode:"espece"|"cheque" }

function nextReceiptNo(allStudents) {
  // Find the highest receipt number across all students and increment
  let max = 606; // start at 607 to match the dojo's existing sequence
  allStudents.forEach(s => (s.payments || []).forEach(p => {
    if (p.receiptNo && Number(p.receiptNo) > max) max = Number(p.receiptNo);
  }));
  return String(max + 1).padStart(7, "0");
}

function buildReceiptHTML(student, payment) {
  const dateStr = payment.date
    ? new Date(payment.date + "T00:00").toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" })
    : "—";
  const monthLabel = payment.month
    ? new Date(payment.month + "-01T00:00").toLocaleDateString("fr-FR", { month:"long", year:"numeric" })
    : "—";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Reçu ${payment.receiptNo} — ${student.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',sans-serif; background:#f5f5f5; display:flex; justify-content:center; align-items:flex-start; min-height:100vh; padding:40px 20px; }
  .receipt { background:#fff; width:100%; max-width:540px; border:1px solid #ddd; border-radius:4px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.12); }
  .header { background:#1a1a1a; color:#fff; padding:24px 28px; display:flex; align-items:center; gap:18px; }
  .logo { width:64px; height:64px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
  .logo svg { width:48px; height:48px; }
  .org h1 { font-family:'Playfair Display',serif; font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:#e8c84a; line-height:1.4; }
  .org p { font-size:10px; color:#aaa; margin-top:4px; line-height:1.6; }
  .receipt-title { background:#c0392b; color:#fff; text-align:center; padding:10px; font-size:11px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; }
  .receipt-no { background:#f8f8f8; border-bottom:1px solid #eee; text-align:center; padding:8px; font-size:11px; color:#555; letter-spacing:.1em; }
  .receipt-no span { font-weight:700; color:#1a1a1a; font-size:15px; margin-left:8px; }
  .body { padding:24px 28px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f0f0f0; }
  .row:last-child { border-bottom:none; }
  .row label { font-size:10px; font-weight:600; color:#888; letter-spacing:.08em; text-transform:uppercase; }
  .row value, .row .val { font-size:13px; color:#1a1a1a; font-weight:500; text-align:right; }
  .amount-row { background:#fffbf0; border:1px solid #e8c84a44; border-radius:6px; padding:14px 16px; margin:16px 0; display:flex; justify-content:space-between; align-items:center; }
  .amount-row label { font-size:11px; color:#888; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
  .amount-row .amount { font-family:'Playfair Display',serif; font-size:26px; color:#1a1a1a; font-weight:700; }
  .checkboxes { margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .cb-group label.group-label { font-size:10px; color:#888; font-weight:700; letter-spacing:.08em; text-transform:uppercase; display:block; margin-bottom:6px; }
  .cb { display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:12px; color:#333; }
  .cb .box { width:13px; height:13px; border:1.5px solid #999; border-radius:2px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .cb .box.checked { background:#1a1a1a; border-color:#1a1a1a; }
  .cb .box.checked::after { content:"✓"; color:#fff; font-size:9px; }
  .footer { border-top:1px solid #eee; padding:20px 28px; display:flex; justify-content:space-between; align-items:flex-end; }
  .stamp { text-align:center; }
  .stamp-circle { width:80px; height:80px; border:2px dashed #ccc; border-radius:50%; margin:0 auto 6px; display:flex; align-items:center; justify-content:center; font-size:9px; color:#bbb; text-align:center; line-height:1.3; }
  .stamp p { font-size:10px; color:#999; }
  .generated { font-size:9px; color:#ccc; text-align:right; margin-top:16px; padding:0 28px 12px; }
  @media print {
    body { background:white; padding:0; }
    .receipt { box-shadow:none; border:none; max-width:100%; }
    .no-print { display:none !important; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="logo">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="22" fill="#1a1a1a" stroke="#e8c84a" stroke-width="1.5"/>
        <circle cx="17" cy="18" r="5" fill="#e8c84a"/>
        <circle cx="31" cy="30" r="5" fill="#fff"/>
        <path d="M17 23 Q24 24 31 25" stroke="#e8c84a" stroke-width="1.5" fill="none"/>
      </svg>
    </div>
    <div class="org">
      <h1>ASS Centre Sportive Casablanca<br/>Casa Dojo — Judo Club</h1>
      <p>27, Rue Ibnou Zaid Arrifai - Maarif - Casablanca<br/>
      Tél: 06 69 822 614 &nbsp;|&nbsp; 06 60 534 479</p>
    </div>
  </div>

  <div class="receipt-title">Reçu de paiement</div>
  <div class="receipt-no">N° <span>${payment.receiptNo}</span></div>

  <div class="body">
    <div class="row"><label>Date</label><span class="val">${dateStr}</span></div>
    <div class="row"><label>Représentant / Élève</label><span class="val">${student.name}</span></div>
    <div class="row"><label>Classe</label><span class="val">${student.judoClass || "—"}</span></div>
    <div class="row"><label>Ceinture</label><span class="val">${student.belt || "—"} Belt</span></div>
    <div class="row"><label>Période</label><span class="val">${monthLabel}</span></div>

    <div class="amount-row">
      <label>Montant reçu</label>
      <span class="amount">${payment.amount} Dhs</span>
    </div>

    <div class="checkboxes">
      <div class="cb-group">
        <label class="group-label">Mode de Règlement</label>
        <div class="cb"><div class="box ${payment.mode === "espece" ? "checked" : ""}"></div> Espèce</div>
        <div class="cb"><div class="box ${payment.mode === "cheque" ? "checked" : ""}"></div> Chèque N° ___________</div>
      </div>
      <div class="cb-group">
        <label class="group-label">Fréquence</label>
        <div class="cb"><div class="box ${payment.freq === "mensuelle" ? "checked" : "checked"}"></div> Mensuelle</div>
        <div class="cb"><div class="box ${payment.freq === "trimestrielle" ? "checked" : ""}"></div> Trimestrielle</div>
        <div class="cb"><div class="box ${payment.freq === "semestrielle" ? "checked" : ""}"></div> Semestrielle</div>
        <div class="cb"><div class="box ${payment.freq === "annuelle" ? "checked" : ""}"></div> Annuelle</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div>
      <div style="font-size:10px;color:#888;margin-bottom:4px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Signature du payeur</div>
      <div style="width:140px;border-bottom:1px solid #ccc;margin-top:32px;"></div>
    </div>
    <div class="stamp">
      <div class="stamp-circle">Cachet<br/>et<br/>Signature</div>
      <p>Casa Dojo</p>
    </div>
  </div>

  <div style="text-align:center;padding:10px 28px 16px;border-top:1px solid #f0f0f0;">
    <button class="no-print" onclick="window.print()" style="background:#1a1a1a;color:#fff;border:none;border-radius:6px;padding:10px 28px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:8px;">
      Imprimer / Télécharger PDF
    </button>
    <button class="no-print" onclick="window.close()" style="background:none;border:1px solid #ccc;border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer;font-family:inherit;color:#555;">
      Fermer
    </button>
  </div>
  <div class="generated">Généré par Casa Dojo Management System</div>
</div>
</body>
</html>`;
}

function openReceipt(student, payment) {
  const w = window.open("", "_blank", "width=620,height=820");
  w.document.write(buildReceiptHTML(student, payment));
  w.document.close();
}

function shareReceiptViaWhatsApp(student, payment) {
  const dateStr = payment.date
    ? new Date(payment.date + "T00:00").toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" })
    : "—";
  const monthLabel = payment.month
    ? new Date(payment.month + "-01T00:00").toLocaleDateString("fr-FR", { month:"long", year:"numeric" })
    : "—";
  const msg = `*Reçu de paiement — Casa Dojo*\n\nN°: ${payment.receiptNo}\nDate: ${dateStr}\nÉlève: ${student.name}\nMontant: ${payment.amount} Dhs\nPériode: ${monthLabel}\n\n_Casa Dojo — 27, Rue Ibnou Zaid Arrifai, Casablanca_`;
  const url = `https://wa.me/${(student.phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* ─── I18N ───────────────────────────────────────────────────────────────── */
const STRINGS = {
  en: {
    appTitle: "Judo Dojo", appSub: "Management System",
    newStudent: "+ NEW STUDENT", settings: "Settings",
    serverConnected: "SERVER CONNECTED", serverConnecting: "CONNECTING...", serverOffline: "SERVER OFFLINE",
    retry: "Retry", retryConn: "Retry Connection",
    navRoster: "Roster", navDashboard: "Dashboard",
    quickStats: "QUICK STATS", students: "Students", paid: "Paid", insured: "Insured", kata: "Kata",
    storageRoot: "STORAGE ROOT", folderRoot: "FOLDER ROOT", clickToChange: "Click to change",
    storageSub: "Each student has a dedicated folder on the server.",
    monthlyRevenue: "MONTHLY REVENUE", apply: "Apply", cancel: "Cancel",
    searchPlaceholder: "Search name or phone...",
    allBelts: "All Belts", allStatus: "All Status", allClasses: "All Classes",
    student: "student", studentsPlural: "students",
    colStudent: "Student", colClass: "Class", colBelt: "Belt", colProgress: "Progress",
    colPaid: "Paid", colInsured: "Insured", colKata: "Kata", colFee: "Fee",
    noMatch: "No students match current filters",
    paidLabel: "Paid", unpaidLabel: "Unpaid", yesLabel: "Yes", noLabel: "No", passLabel: "Pass",
    dashTitle: "Dojo Overview",
    statTotal: "Total Members", statTotalSub: "active",
    statPaid: "Paid This Month", statInsured: "Insured", statUninsured: "uninsured",
    statKata: "Kata Certified", statKataSub: "passed exam",
    statProgress: "Avg. BB Progress", statProgressSub: "toward black belt",
    statUnpaid: "Unpaid", statPastDue: "past due", statGrace: "within grace period",
    beltDist: "Belt Distribution", classDist: "Class Distribution",
    unpaidTitle: "Unpaid Subscriptions", actionRequired: "— Action Required", gracePeriod: "— Grace Period",
    whatsappBtn: "WhatsApp Reminder", whatsappSent: "Sent",
    tabInfo: "Info", tabNotes: "Notes", tabFiles: "Files",
    rowAge: "Age", rowBirthday: "Birthday", rowPhone: "Phone", rowMember: "Member since",
    rowFee: "Subscription Fee", rowPoints: "Points",
    bbProgress: "Black Belt Progression",
    pillPaid: "Paid", pillInsured: "Insured", pillKata: "Kata Exam",
    waSend: "Send WhatsApp payment reminder", waSent: "Reminder sent",
    editProfile: "Edit Profile", delete: "Delete",
    studentNotes: "Student Notes", fetchingNote: "Fetching from server...", noteSavedTo: "Saved to",
    noteSaving: "saving...", noteSaved: "saved to server", noteFailed: "save failed",
    studentFiles: "Student Files", upload: "+ Upload", uploading: "Uploading...",
    uploadPrompt: "Click to upload photos or documents",
    uploadSub: "Stored in", addMore: "+ Add more files",
    loadingStudents: "Fetching students from server...",
    serverError: "Cannot reach the backend server.",
    serverErrorSub: "Make sure the backend is running on",
    serverErrorRun: "in the dojo-backend folder",
    formEditTitle: "Edit Student Profile", formNewTitle: "New Student",
    fieldName: "Full Name", fieldAge: "Age", fieldBirthday: "Birthday",
    fieldPhone: "Phone (WhatsApp)", fieldJoin: "Join Date", fieldFee: "Subscription Fee (MAD)",
    fieldBelt: "Belt", fieldClass: "Class", fieldPoints: "Points",
    fieldProgress: "Black Belt Progress (0 – 100)", fieldPhoto: "Profile Photo",
    photoUpload: "Click to upload photo", photoChange: "Click to change",
    save: "Save", saving: "Saving...",
    confirmDelete: "CONFIRM DELETE", deleteWarning: "The student profile, notes, and all uploaded files for",
    deleteWarning2: "will be permanently removed from the server. This action cannot be undone.",
    deleting: "Deleting...",
    settingsTitle: "Settings",
    settingsStorage: "Storage Root", settingsStorageSub: "The folder where student data is stored on the server.",
    settingsTheme: "Color Theme", themeDark: "Dark", themeLight: "Light",
    settingsLang: "Language",
    settingsSave: "Save Settings", settingsClose: "Close",
    toastUpdated: "Profile updated.", toastCreated: "Student created — folder ready on server.",
    toastDeleted: "Student and folder removed.", toastSyncErr: "Sync error.",
    toastSaveErr: "Server error — could not save.", toastDelErr: "Server error — could not delete.",
    toastRootSet: "Root set to", toastRootErr: "Could not update root directory.",
    toastNameReq: "Name is required.",
    unpaidBanner: "UNPAID — PAST 5TH",
    yearsOld: "years old",
    tabPayments: "Payments",
    payHistory: "PAYMENT HISTORY",
    payAddTitle: "Record Payment",
    payMonth: "Month", payDate: "Payment Date", payAmount: "Amount (MAD)",
    payMode: "Payment Mode", payEspece: "Cash (Espèce)", payCheque: "Cheque",
    payRecord: "Record", payCancel: "Cancel",
    payNoHistory: "No payments recorded yet.",
    payPaid: "Paid", payUnpaid: "Unpaid",
    payReceipt: "Receipt", payWhatsApp: "Send via WhatsApp",
    payMarkPaid: "Mark as Paid", payMarkUnpaid: "Mark Unpaid",
    payTotal: "Total paid this year",
  },
  fr: {
    appTitle: "Dojo Judo", appSub: "Système de Gestion",
    newStudent: "+ NOUVEL ÉLÈVE", settings: "Paramètres",
    serverConnected: "SERVEUR CONNECTÉ", serverConnecting: "CONNEXION...", serverOffline: "SERVEUR HORS LIGNE",
    retry: "Réessayer", retryConn: "Reconnecter",
    navRoster: "Liste", navDashboard: "Tableau de bord",
    quickStats: "STATS RAPIDES", students: "Élèves", paid: "Payé", insured: "Assuré", kata: "Kata",
    storageRoot: "RÉPERTOIRE", folderRoot: "DOSSIER RACINE", clickToChange: "Cliquer pour modifier",
    storageSub: "Chaque élève a un dossier dédié sur le serveur.",
    monthlyRevenue: "REVENUS MENSUELS", apply: "Appliquer", cancel: "Annuler",
    searchPlaceholder: "Rechercher nom ou téléphone...",
    allBelts: "Toutes ceintures", allStatus: "Tous statuts", allClasses: "Toutes classes",
    student: "élève", studentsPlural: "élèves",
    colStudent: "Élève", colClass: "Classe", colBelt: "Ceinture", colProgress: "Progression",
    colPaid: "Payé", colInsured: "Assuré", colKata: "Kata", colFee: "Cotisation",
    noMatch: "Aucun élève ne correspond aux filtres",
    paidLabel: "Payé", unpaidLabel: "Impayé", yesLabel: "Oui", noLabel: "Non", passLabel: "Réussi",
    dashTitle: "Vue d'ensemble",
    statTotal: "Total Membres", statTotalSub: "actifs",
    statPaid: "Payé ce mois", statInsured: "Assurés", statUninsured: "non assurés",
    statKata: "Certifiés Kata", statKataSub: "examen réussi",
    statProgress: "Prog. moy. CB", statProgressSub: "vers ceinture noire",
    statUnpaid: "Impayés", statPastDue: "en retard", statGrace: "dans le délai",
    beltDist: "Répartition des ceintures", classDist: "Répartition des classes",
    unpaidTitle: "Cotisations impayées", actionRequired: "— Action requise", gracePeriod: "— Délai de grâce",
    whatsappBtn: "Rappel WhatsApp", whatsappSent: "Envoyé",
    tabInfo: "Infos", tabNotes: "Notes", tabFiles: "Fichiers",
    rowAge: "Âge", rowBirthday: "Date de naissance", rowPhone: "Téléphone", rowMember: "Membre depuis",
    rowFee: "Cotisation", rowPoints: "Points",
    bbProgress: "Progression ceinture noire",
    pillPaid: "Payé", pillInsured: "Assuré", pillKata: "Examen Kata",
    waSend: "Envoyer un rappel WhatsApp", waSent: "Rappel envoyé",
    editProfile: "Modifier le profil", delete: "Supprimer",
    studentNotes: "Notes élève", fetchingNote: "Chargement depuis le serveur...", noteSavedTo: "Enregistré dans",
    noteSaving: "enregistrement...", noteSaved: "enregistré", noteFailed: "échec",
    studentFiles: "Fichiers élève", upload: "+ Téléverser", uploading: "Envoi...",
    uploadPrompt: "Cliquez pour téléverser photos ou documents",
    uploadSub: "Stocké dans", addMore: "+ Ajouter des fichiers",
    loadingStudents: "Chargement des élèves depuis le serveur...",
    serverError: "Impossible de joindre le serveur.",
    serverErrorSub: "Assurez-vous que le backend tourne sur",
    serverErrorRun: "dans le dossier dojo-backend",
    formEditTitle: "Modifier le profil", formNewTitle: "Nouvel élève",
    fieldName: "Nom complet", fieldAge: "Âge", fieldBirthday: "Date de naissance",
    fieldPhone: "Téléphone (WhatsApp)", fieldJoin: "Date d'inscription", fieldFee: "Cotisation (MAD)",
    fieldBelt: "Ceinture", fieldClass: "Classe", fieldPoints: "Points",
    fieldProgress: "Progression ceinture noire (0 – 100)", fieldPhoto: "Photo de profil",
    photoUpload: "Cliquer pour ajouter une photo", photoChange: "Cliquer pour changer",
    save: "Enregistrer", saving: "Enregistrement...",
    confirmDelete: "CONFIRMER LA SUPPRESSION", deleteWarning: "Le profil, les notes et tous les fichiers de",
    deleteWarning2: "seront définitivement supprimés du serveur. Cette action est irréversible.",
    deleting: "Suppression...",
    settingsTitle: "Paramètres",
    settingsStorage: "Répertoire de stockage", settingsStorageSub: "Le dossier où les données des élèves sont stockées.",
    settingsTheme: "Thème de couleur", themeDark: "Sombre", themeLight: "Clair",
    settingsLang: "Langue",
    settingsSave: "Enregistrer", settingsClose: "Fermer",
    toastUpdated: "Profil mis à jour.", toastCreated: "Élève créé — dossier prêt sur le serveur.",
    toastDeleted: "Élève et dossier supprimés.", toastSyncErr: "Erreur de synchronisation.",
    toastSaveErr: "Erreur serveur — impossible d'enregistrer.", toastDelErr: "Erreur serveur — impossible de supprimer.",
    toastRootSet: "Répertoire défini sur", toastRootErr: "Impossible de modifier le répertoire.",
    toastNameReq: "Le nom est obligatoire.",
    unpaidBanner: "IMPAYÉS — APRÈS LE 5",
    yearsOld: "ans",
    tabPayments: "Paiements",
    payHistory: "HISTORIQUE DES PAIEMENTS",
    payAddTitle: "Enregistrer un paiement",
    payMonth: "Mois", payDate: "Date du paiement", payAmount: "Montant (MAD)",
    payMode: "Mode de règlement", payEspece: "Espèce", payCheque: "Chèque",
    payRecord: "Enregistrer", payCancel: "Annuler",
    payNoHistory: "Aucun paiement enregistré.",
    payPaid: "Payé", payUnpaid: "Impayé",
    payReceipt: "Reçu", payWhatsApp: "Envoyer WhatsApp",
    payMarkPaid: "Marquer payé", payMarkUnpaid: "Marquer impayé",
    payTotal: "Total payé cette année",
  },
};

/* ─── THEME PALETTES ─────────────────────────────────────────────────────── */
const THEMES = {
  dark: {
    bg: "#0c0c0c", bgPanel: "#0e0e0e", bgCard: "#141414", bgInput: "#0f0f0f",
    bgHover: "#141414", bgSel: "#161616", bgAlt: "#0a0a0a",
    border: "#1c1c1c", borderMid: "#252525", borderSub: "#141414", borderInput: "#2a2a2a",
    text: "#d0d0d0", textMid: "#c0c0c0", textSub: "#707070", textFaint: "#505050", textDim: "#404040", textGhost: "#353535",
    accent: "#c0392b", accentHover: "#922b21",
    scrollThumb: "#252525",
    inputColorScheme: "dark",
    trowHover: "#141414", trowSel: "#161616",
    headerBg: "#0c0c0c",
    modalBg: "rgba(0,0,0,.78)",
    toastBg: "#141414",
  },
  light: {
    bg: "#f4f4f4", bgPanel: "#ffffff", bgCard: "#fafafa", bgInput: "#ffffff",
    bgHover: "#f0f0f0", bgSel: "#fce8e6", bgAlt: "#f8f8f8",
    border: "#e0e0e0", borderMid: "#d0d0d0", borderSub: "#ebebeb", borderInput: "#cccccc",
    text: "#1a1a1a", textMid: "#2a2a2a", textSub: "#555555", textFaint: "#777777", textDim: "#888888", textGhost: "#aaaaaa",
    accent: "#c0392b", accentHover: "#922b21",
    scrollThumb: "#cccccc",
    inputColorScheme: "light",
    trowHover: "#f5f5f5", trowSel: "#fce8e6",
    headerBg: "#ffffff",
    modalBg: "rgba(0,0,0,.5)",
    toastBg: "#ffffff",
  },
};

/* ─── CONTEXTS ───────────────────────────────────────────────────────────── */
const ThemeCtx = createContext(THEMES.dark);
const LangCtx  = createContext(STRINGS.en);
const useT  = () => useContext(ThemeCtx);
const useL  = () => useContext(LangCtx);

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
  kata: false, progress: 0, points: 0, joined: "", photo: "",
  payments: [],
};

function waURL(phone, name, lang) {
  const msg = lang === "fr"
    ? `Bonjour ${name},\n\nNous vous rappelons que votre cotisation mensuelle n'a pas encore été réglée. Merci de procéder au paiement avant le 5 du mois.\n\nCordialement,\nVotre Dojo Judo`
    : `Hello ${name},\n\nThis is a reminder that your monthly subscription has not yet been paid. Please make your payment before the 5th of the month.\n\nBest regards,\nYour Judo Dojo`;
  return `https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
}

/* ─── UI PRIMITIVES ──────────────────────────────────────────────────────── */
function BeltPip({ belt, size = 18 }) {
  const b = BELTS.find(x => x.name === belt) || BELTS[0];
  return <span style={{ display:"inline-block", width:size*2.8, height:size*0.55, background:b.hex, borderRadius:2, border:b.outline?"1px solid #555":"none", verticalAlign:"middle", flexShrink:0 }} />;
}
function BeltChip({ belt }) {
  const b = BELTS.find(x => x.name === belt) || BELTS[0];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:b.dark?b.hex:b.hex+"22", color:b.dark?"#fff":"#1a1a1a", border:`1px solid ${b.hex}${b.dark?"88":"66"}`, borderRadius:4, padding:"3px 9px 3px 7px", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}><BeltPip belt={belt} size={10}/>{belt}</span>;
}
function ClassChip({ cls }) {
  const map = {"Baby Judo":["#4a90b8","#0d2a3a"],"Junior":["#7a6abf","#1e1a35"],"Senior":["#b05a4a","#2e1510"]};
  const [fg,bg] = map[cls]||["#888","#222"];
  return <span style={{ display:"inline-block", background:bg, color:fg, border:`1px solid ${fg}66`, borderRadius:4, padding:"3px 9px", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{cls}</span>;
}
function StatusDot({ on, label }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
    <span style={{ width:7, height:7, borderRadius:"50%", background:on?"#3db870":"#c04040", boxShadow:`0 0 5px ${on?"#3db870":"#c04040"}99`, display:"inline-block", flexShrink:0 }}/>
    <span style={{ fontSize:12, color:on?"#5dba7d":"#c47070" }}>{label}</span>
  </span>;
}
function ProgressBar({ value }) {
  const T = useT();
  const pct = Math.min(100,Math.max(0,value));
  const color = pct>=85?"#e8c84a":pct>=50?"#c0392b":"#5a7a9a";
  return <div style={{ display:"flex", alignItems:"center", gap:10 }}>
    <div style={{ flex:1, height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width .4s ease" }}/>
    </div>
    <span style={{ fontSize:11, color:T.textDim, fontVariantNumeric:"tabular-nums", minWidth:30, textAlign:"right" }}>{pct}/100</span>
  </div>;
}
function Pill({ on, onClick, label, activeColor="#c0392b" }) {
  const T = useT();
  return <button onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:8, background:on?activeColor+"18":T.bgPanel, border:`1px solid ${on?activeColor+"88":T.borderInput}`, borderRadius:6, padding:"6px 14px", cursor:"pointer", transition:"all .18s", color:on?activeColor:T.textFaint, fontSize:12, fontWeight:600, letterSpacing:"0.05em", fontFamily:"inherit" }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:on?activeColor:T.textDim, display:"inline-block", flexShrink:0, transition:"background .18s" }}/>
    {label}
  </button>;
}

/* ─── AVATAR ─────────────────────────────────────────────────────────────── */
function Avatar({ src, name, size = 44 }) {
  const T = useT();
  const initials = name ? name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase() : "?";
  if (src) return <img src={src} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`2px solid ${T.borderMid}` }}/>;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:T.border, border:`2px solid ${T.borderMid}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.36, fontWeight:700, color:T.textFaint, flexShrink:0, fontFamily:"'Cormorant Garamond',serif" }}>{initials}</div>;
}

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function Toast({ message, type }) {
  const T = useT();
  if (!message) return null;
  const color = type==="error"?"#c04040":type==="warn"?"#c08040":"#3a9a60";
  return <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:T.toastBg, border:`1px solid ${color}66`, borderRadius:8, padding:"11px 18px", fontSize:12, color:T.text, fontFamily:"'DM Mono',monospace", boxShadow:"0 8px 32px rgba(0,0,0,.3)", display:"flex", alignItems:"center", gap:10, animation:"fadeIn .2s ease" }}>
    <span style={{ width:7, height:7, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }}/>
    {message}
  </div>;
}

/* ─── MODAL ──────────────────────────────────────────────────────────────── */
function Modal({ open, onClose, width=560, children }) {
  const T = useT();
  useEffect(() => { document.body.style.overflow=open?"hidden":""; return()=>{document.body.style.overflow=""}; }, [open]);
  if (!open) return null;
  return <div onClick={onClose} style={{ position:"fixed", inset:0, background:T.modalBg, display:"flex", alignItems:"center", justifyContent:"center", zIndex:900, backdropFilter:"blur(6px)", padding:20 }}>
    <div onClick={e=>e.stopPropagation()} style={{ background:T.bgCard, border:`1px solid ${T.borderMid}`, borderRadius:14, width:"100%", maxWidth:width, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,.5)" }}>{children}</div>
  </div>;
}

/* ─── SETTINGS MODAL ─────────────────────────────────────────────────────── */
function SettingsModal({ open, onClose, rootDir, onApplyRoot, themeName, onTheme, lang, onLang }) {
  const T   = useT();
  const L   = useL();
  const [draft, setDraft] = useState(rootDir);
  useEffect(() => { setDraft(rootDir); }, [rootDir, open]);

  const row = (label, sub, children) => (
    <div style={{ paddingBottom:20, marginBottom:20, borderBottom:`1px solid ${T.border}` }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.text, letterSpacing:"0.06em", marginBottom:sub?4:10 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:T.textDim, marginBottom:10 }}>{sub}</div>}
      {children}
    </div>
  );
  const inp = { background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:6, color:T.text, padding:"9px 12px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit" };
  const optBtn = (val, cur, set, label) => (
    <button key={val} onClick={()=>set(val)} style={{ flex:1, background:cur===val?T.accent:T.bgPanel, border:`1px solid ${cur===val?T.accent:T.borderInput}`, color:cur===val?"#fff":T.textSub, borderRadius:6, padding:"8px 0", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"inherit", transition:"all .15s" }}>{label}</button>
  );

  return (
    <Modal open={open} onClose={onClose} width={460}>
      <div style={{ padding:32 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28, paddingBottom:20, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>{L.settingsTitle}</div>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${T.borderMid}`, color:T.textFaint, borderRadius:6, width:32, height:32, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>&#x2715;</button>
        </div>

        {row(L.settingsStorage, L.settingsStorageSub,
          <div style={{ display:"flex", gap:8 }}>
            <input value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") onApplyRoot(draft); }}
              style={inp} placeholder="D:/JudoDojo" />
            <button onClick={()=>onApplyRoot(draft)} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:6, padding:"9px 16px", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit", whiteSpace:"nowrap" }}>{L.apply}</button>
          </div>
        )}

        {row(L.settingsTheme, null,
          <div style={{ display:"flex", gap:8 }}>
            {optBtn("dark",  themeName, onTheme, L.themeDark)}
            {optBtn("light", themeName, onTheme, L.themeLight)}
          </div>
        )}

        {row(L.settingsLang, null,
          <div style={{ display:"flex", gap:8 }}>
            {optBtn("en", lang, onLang, "English")}
            {optBtn("fr", lang, onLang, "Français")}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:6, padding:"9px 28px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>{L.settingsClose}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── STUDENT FORM ───────────────────────────────────────────────────────── */
// Field is defined OUTSIDE the form so React never unmounts inputs on re-render
function FormField({ label, span, T, children }) {
  return (
    <div style={{ gridColumn:span?"1 / -1":undefined }}>
      <label style={{ display:"block", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.textFaint, marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

function StudentForm({ initial, onSave, onCancel, saving, lang }) {
  const T = useT();
  const L = useL();
  // useRef freezes initial on mount so it never re-initializes mid-edit
  const frozen = useRef({ ...EMPTY, ...initial }).current;
  const [f, setF] = useState(frozen);
  const photoInputRef = useRef(null);

  const inp = { background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:6, color:T.text, padding:"9px 12px", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit" };

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setF(p => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28, paddingBottom:20, borderBottom:`1px solid ${T.border}` }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>
            {frozen.name ? L.formEditTitle : L.formNewTitle}
          </div>
          {frozen.name && <div style={{ fontSize:12, color:T.textFaint, marginTop:2 }}>{frozen.name}</div>}
        </div>
        <button onClick={onCancel} style={{ background:"none", border:`1px solid ${T.borderMid}`, color:T.textFaint, borderRadius:6, width:32, height:32, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>&#x2715;</button>
      </div>

      {/* Photo upload */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24, paddingBottom:24, borderBottom:`1px solid ${T.border}` }}>
        <Avatar src={f.photo} name={f.name} size={60} />
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.textFaint, marginBottom:6 }}>{L.fieldPhoto}</div>
          <button onClick={()=>photoInputRef.current?.click()} style={{ background:T.bgPanel, border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:600 }}>
            {f.photo ? L.photoChange : L.photoUpload}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:"none" }}/>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px 20px", marginBottom:20 }}>
        <FormField label={L.fieldName} span T={T}>
          <input style={inp} value={f.name} onChange={e=>{const v=e.target.value;setF(p=>({...p,name:v}));}} placeholder="Ahmed Benali"/>
        </FormField>
        <FormField label={L.fieldAge} T={T}>
          <input style={inp} type="number" value={f.age} onChange={e=>{const v=e.target.value;setF(p=>({...p,age:v}));}} placeholder="20" min={3} max={80}/>
        </FormField>
        <FormField label={L.fieldBirthday} T={T}>
          <input style={inp} type="date" value={f.birthday} onChange={e=>{const v=e.target.value;setF(p=>({...p,birthday:v}));}}/>
        </FormField>
        <FormField label={L.fieldPhone} T={T}>
          <input style={inp} value={f.phone} onChange={e=>{const v=e.target.value;setF(p=>({...p,phone:v}));}} placeholder="+212600000000"/>
        </FormField>
        <FormField label={L.fieldJoin} T={T}>
          <input style={inp} type="date" value={f.joined} onChange={e=>{const v=e.target.value;setF(p=>({...p,joined:v}));}}/>
        </FormField>
        <FormField label={L.fieldFee} T={T}>
          <input style={inp} type="number" value={f.fee} onChange={e=>{const v=e.target.value;setF(p=>({...p,fee:v}));}} placeholder="250" min={0}/>
        </FormField>
        <FormField label={L.fieldBelt} T={T}>
          <select style={{...inp,cursor:"pointer"}} value={f.belt} onChange={e=>{const v=e.target.value;setF(p=>({...p,belt:v}));}}>
            {BELTS.map(b=><option key={b.name} value={b.name}>{b.name} Belt</option>)}
          </select>
        </FormField>
        <FormField label={L.fieldClass} T={T}>
          <select style={{...inp,cursor:"pointer"}} value={f.judoClass} onChange={e=>{const v=e.target.value;setF(p=>({...p,judoClass:v}));}}>
            {CLASSES.map(c=><option key={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label={L.fieldPoints} T={T}>
          <input style={inp} type="number" value={f.points} onChange={e=>{const v=e.target.value;setF(p=>({...p,points:v}));}} min={0} max={9999}/>
        </FormField>
        <FormField label={L.fieldProgress} T={T}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <input type="range" min={0} max={100} value={f.progress} onChange={e=>{const v=Number(e.target.value);setF(p=>({...p,progress:v}));}} style={{ flex:1, accentColor:T.accent }}/>
            <span style={{ color:"#e8c84a", fontWeight:700, fontSize:15, minWidth:28, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{f.progress}</span>
          </div>
        </FormField>
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", padding:"16px 0", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, marginBottom:24 }}>
        <Pill on={f.paid}    onClick={()=>setF(p=>({...p,paid:!p.paid}))}       label={L.pillPaid}    activeColor="#3a9a60"/>
        <Pill on={f.insured} onClick={()=>setF(p=>({...p,insured:!p.insured}))} label={L.pillInsured} activeColor="#3a7abf"/>
        <Pill on={f.kata}    onClick={()=>setF(p=>({...p,kata:!p.kata}))}       label={L.pillKata}    activeColor="#8a4abf"/>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <button onClick={onCancel} disabled={saving} style={{ background:"none", border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:6, padding:"9px 22px", cursor:"pointer", fontSize:13, fontFamily:"inherit", opacity:saving?.5:1 }}>{L.cancel}</button>
        <button onClick={()=>onSave(f)} disabled={saving} style={{ background:saving?"#7a2020":T.accent, border:"none", color:"#fff", borderRadius:6, padding:"9px 28px", cursor:saving?"wait":"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", letterSpacing:"0.04em", transition:"background .2s", minWidth:80 }}>
          {saving ? L.saving : L.save}
        </button>
      </div>
    </div>
  );
}

/* ─── PAYMENTS TAB ───────────────────────────────────────────────────────── */
function PaymentsTab({ student, onUpdateStudent, allStudents }) {
  const T = useT();
  const L = useL();
  const payments = useMemo(() => [...(student.payments || [])].sort((a,b) => b.month.localeCompare(a.month)), [student.payments]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ month: "", date: new Date().toISOString().slice(0,10), amount: student.fee || "", mode: "espece" });

  // Current year totals
  const thisYear = String(new Date().getFullYear());
  const yearPaid = payments.filter(p => p.paid && p.month?.startsWith(thisYear)).reduce((a,p) => a + Number(p.amount||0), 0);

  // Generate all months from join date until now for the timeline
  const allMonths = useMemo(() => {
    const months = [];
    const start = student.joined ? new Date(student.joined + "T00:00") : new Date(Date.now() - 365*24*3600*1000);
    const end = new Date();
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
      months.push(key);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.reverse();
  }, [student.joined]);

  const paymentMap = useMemo(() => {
    const m = {};
    (student.payments || []).forEach(p => { m[p.month] = p; });
    return m;
  }, [student.payments]);

  async function recordPayment() {
    if (!form.month) return;
    const receiptNo = nextReceiptNo(allStudents);
    const newPayment = {
      id: Date.now().toString(36),
      month: form.month,
      date: form.date,
      amount: Number(form.amount) || Number(student.fee) || 0,
      mode: form.mode,
      freq: "mensuelle",
      paid: true,
      receiptNo,
    };
    const existing = (student.payments || []).filter(p => p.month !== form.month);
    const updated = { ...student, payments: [...existing, newPayment], paid: true };
    await onUpdateStudent(updated);
    setAdding(false);
    setForm({ month: "", date: new Date().toISOString().slice(0,10), amount: student.fee || "", mode: "espece" });
  }

  async function toggleMonthPaid(monthKey) {
    const existing = paymentMap[monthKey];
    let updatedPayments;
    if (existing) {
      updatedPayments = (student.payments || []).map(p => p.month === monthKey ? { ...p, paid: !p.paid } : p);
    } else {
      const receiptNo = nextReceiptNo(allStudents);
      updatedPayments = [...(student.payments || []), {
        id: Date.now().toString(36), month: monthKey,
        date: new Date().toISOString().slice(0,10),
        amount: Number(student.fee) || 0, mode: "espece", freq: "mensuelle",
        paid: true, receiptNo,
      }];
    }
    const currentMonth = new Date().toISOString().slice(0,7);
    const currentPaid = updatedPayments.find(p => p.month === currentMonth)?.paid ?? false;
    await onUpdateStudent({ ...student, payments: updatedPayments, paid: currentPaid });
  }

  const inp = { background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:6, color:T.text, padding:"8px 10px", fontSize:12, outline:"none", fontFamily:"inherit", width:"100%" };
  const monthLabel = (m) => new Date(m + "-01T00:00").toLocaleDateString("fr-FR", { month:"long", year:"numeric" });

  return (
    <div>
      {/* Year summary */}
      <div style={{ background:T.bgAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{L.payTotal} ({thisYear})</span>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:T.text }}>MAD {yearPaid.toLocaleString()}</span>
      </div>

      {/* Add payment button */}
      {!adding && (
        <button onClick={() => setAdding(true)} style={{ width:"100%", background:T.accent, border:"none", color:"#fff", borderRadius:7, padding:"9px", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit", letterSpacing:"0.04em", marginBottom:16 }}>
          + {L.payAddTitle}
        </button>
      )}

      {/* Add payment form */}
      {adding && (
        <div style={{ background:T.bgAlt, border:`1px solid ${T.borderInput}`, borderRadius:8, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>{L.payAddTitle}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ display:"block", fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{L.payMonth}</label>
              <input type="month" value={form.month} onChange={e=>setForm(f=>({...f,month:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{L.payDate}</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{L.payAmount}</label>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={inp} min={0}/>
            </div>
            <div>
              <label style={{ display:"block", fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{L.payMode}</label>
              <select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                <option value="espece">{L.payEspece}</option>
                <option value="cheque">{L.payCheque}</option>
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={recordPayment} style={{ flex:1, background:T.accent, border:"none", color:"#fff", borderRadius:6, padding:"8px", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit" }}>{L.payRecord}</button>
            <button onClick={()=>setAdding(false)} style={{ background:"none", border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:6, padding:"8px 14px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{L.payCancel}</button>
          </div>
        </div>
      )}

      {/* Month-by-month timeline */}
      <div style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{L.payHistory}</div>
      {allMonths.length === 0 && (
        <div style={{ color:T.textGhost, fontSize:12, padding:"20px 0", textAlign:"center" }}>{L.payNoHistory}</div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {allMonths.map(m => {
          const p = paymentMap[m];
          const isPaid = p?.paid;
          const isCurrentMonth = m === new Date().toISOString().slice(0,7);
          return (
            <div key={m} style={{
              background: isPaid ? (T.inputColorScheme==="dark" ? "#0d1f0d" : "#f0faf0") : (T.inputColorScheme==="dark" ? "#1a0d0d" : "#fff8f8"),
              border: `1px solid ${isPaid ? "#2a4a2a" : isCurrentMonth ? T.accent+"66" : T.borderSub}`,
              borderRadius:7, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
            }}>
              {/* Status dot */}
              <div style={{ width:8, height:8, borderRadius:"50%", background:isPaid?"#3db870":"#c04040", flexShrink:0, boxShadow:`0 0 5px ${isPaid?"#3db870":"#c04040"}88` }}/>
              {/* Month label */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, textTransform:"capitalize" }}>{monthLabel(m)}{isCurrentMonth ? <span style={{ marginLeft:8, fontSize:9, color:T.accent, fontWeight:700, letterSpacing:"0.1em" }}>CURRENT</span> : ""}</div>
                {p && <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>
                  {p.paid ? `MAD ${p.amount} · ${p.mode === "espece" ? "Espèce" : "Chèque"} · Reçu N°${p.receiptNo}` : "Non payé"}
                </div>}
              </div>
              {/* Actions */}
              <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                <button
                  onClick={() => toggleMonthPaid(m)}
                  style={{ background:isPaid?"#1a2e1a":"#2a1414", border:`1px solid ${isPaid?"#2a4a2a":"#4a2020"}`, color:isPaid?"#5dba7d":"#c07070", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  {isPaid ? L.payMarkUnpaid : L.payMarkPaid}
                </button>
                {p?.paid && (<>
                  <button
                    onClick={() => openReceipt(student, p)}
                    title={L.payReceipt}
                    style={{ background:T.bgPanel, border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"inherit" }}>
                    PDF
                  </button>
                  <button
                    onClick={() => shareReceiptViaWhatsApp(student, p)}
                    title={L.payWhatsApp}
                    style={{ background:"#0d2a1e", border:"1px solid #1a4a2a", color:"#3db870", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"inherit" }}>
                    WA
                  </button>
                </>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── DETAIL PANEL ───────────────────────────────────────────────────────── */
function DetailPanel({ student:s, onClose, onEdit, onDelete, onToggle, onProgress, notifSent, onNotif, lang, onUpdateStudent, allStudents }) {
  const T = useT();
  const L = useL();
  const [note,       setNote]       = useState("");
  const [noteStatus, setNoteStatus] = useState("idle");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [uploaded,   setUploaded]   = useState([]);
  const [uploading,  setUploading]  = useState(false);
  const [activeTab,  setActiveTab]  = useState("info");
  const fileRef  = useRef(null);
  const noteTimer = useRef(null);

  useEffect(() => {
    setNoteLoaded(false); setNote("");
    api.getNote(s.name).then(r=>{setNote(r.note??"");setNoteLoaded(true);}).catch(()=>setNoteLoaded(true));
  }, [s.name]);

  function handleNoteChange(val) {
    setNote(val); setNoteStatus("saving");
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async()=>{
      try { await api.saveNote(s.name,val); setNoteStatus("saved"); setTimeout(()=>setNoteStatus("idle"),2000); }
      catch { setNoteStatus("error"); }
    },600);
  }

  async function handleFileUpload(e) {
    const files=e.target.files; if(!files.length) return;
    setUploading(true);
    try { const r=await api.uploadFiles(s.name,files); if(r.files) setUploaded(p=>[...p,...r.files]); }
    catch {} finally { setUploading(false); e.target.value=""; }
  }

  function formatBytes(b) { if(b<1024) return `${b} B`; if(b<1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB`; }
  function fileIcon(n="") { const e=n.split(".").pop().toLowerCase(); if(["jpg","jpeg","png","gif","webp","bmp"].includes(e)) return "▣"; if(e==="pdf") return "▤"; if(["doc","docx"].includes(e)) return "▦"; return "▢"; }

  const nsColor = { idle:T.textGhost, saving:"#e8c84a", saved:"#3a9a60", error:"#c04040" };
  const nsLabel = { idle:"", saving:L.noteSaving, saved:L.noteSaved, error:L.noteFailed };

  const row = (label,value) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.borderSub}` }}>
      <span style={{ fontSize:11, color:T.textFaint, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</span>
      <span style={{ fontSize:13, color:T.textMid }}>{value}</span>
    </div>
  );
  const tabBtn = (id,label) => (
    <button onClick={()=>setActiveTab(id)} style={{ background:activeTab===id?T.bgHover:"none", border:"none", borderBottom:`2px solid ${activeTab===id?T.accent:"transparent"}`, color:activeTab===id?T.text:T.textFaint, padding:"8px 14px", cursor:"pointer", fontSize:11, fontWeight:700, letterSpacing:"0.08em", fontFamily:"inherit", textTransform:"uppercase", transition:"all .15s" }}>{label}</button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ padding:"24px 24px 0", borderBottom:`1px solid ${T.borderSub}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
            <Avatar src={s.photo} name={s.name} size={48}/>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>{s.name}</div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                <BeltChip belt={s.belt}/><ClassChip cls={s.judoClass}/>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${T.borderMid}`, color:T.textFaint, borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>&#x2715;</button>
        </div>
        <div style={{ display:"flex", gap:0, marginBottom:-1 }}>
          {tabBtn("info",     L.tabInfo)}
          {tabBtn("payments", L.tabPayments)}
          {tabBtn("notes",    L.tabNotes)}
          {tabBtn("files",    L.tabFiles)}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:"auto", padding:24 }}>

        {activeTab==="info" && (<>
          <div style={{ marginBottom:20 }}>
            {row(L.rowAge, `${s.age} ${L.yearsOld}`)}
            {row(L.rowBirthday, s.birthday?new Date(s.birthday+"T00:00").toLocaleDateString(lang==="fr"?"fr-FR":"en-GB",{day:"2-digit",month:"long",year:"numeric"}):"—")}
            {row(L.rowPhone, s.phone)}
            {row(L.rowMember, s.joined?new Date(s.joined+"T00:00").toLocaleDateString(lang==="fr"?"fr-FR":"en-GB",{month:"long",year:"numeric"}):"—")}
            {row(L.rowFee, `MAD ${s.fee}`)}
            {row(L.rowPoints, s.points)}
          </div>
          <div style={{ marginBottom:20, padding:"14px 16px", background:T.bgAlt, borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{L.bbProgress}</div>
            <ProgressBar value={s.progress}/>
            <input type="range" min={0} max={100} value={s.progress} onChange={e=>onProgress("progress",Number(e.target.value))} style={{ width:"100%", marginTop:8, accentColor:T.accent }}/>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
            <Pill on={s.paid}    onClick={()=>onToggle("paid")}    label={L.pillPaid}    activeColor="#3a9a60"/>
            <Pill on={s.insured} onClick={()=>onToggle("insured")} label={L.pillInsured} activeColor="#3a7abf"/>
            <Pill on={s.kata}    onClick={()=>onToggle("kata")}    label={L.pillKata}    activeColor="#8a4abf"/>
          </div>
          {!s.paid && (
            <a href={waURL(s.phone,s.name,lang)} target="_blank" rel="noopener noreferrer" onClick={onNotif} style={{ display:"block", textAlign:"center", background:notifSent?"#1a2e1a":"#128C7E", color:notifSent?"#4a9a4a":"#fff", borderRadius:6, padding:"11px", fontWeight:700, fontSize:12, textDecoration:"none", marginBottom:16, letterSpacing:"0.04em", border:`1px solid ${notifSent?"#2a4a2a":"#128C7E"}`, transition:"all .2s" }}>
              {notifSent ? L.waSent : L.waSend}
            </a>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onEdit} style={{ flex:1, background:T.bgPanel, border:`1px solid ${T.borderInput}`, color:T.textMid, borderRadius:6, padding:10, cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"inherit" }}>{L.editProfile}</button>
            <button onClick={onDelete} style={{ background:"#1e1010", border:"1px solid #3a2020", color:"#c07070", borderRadius:6, padding:"10px 18px", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>{L.delete}</button>
          </div>
        </>)}

        {activeTab==="payments" && (
          <PaymentsTab
            student={s}
            onUpdateStudent={onUpdateStudent}
            allStudents={allStudents}
          />
        )}

        {activeTab==="notes" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>{L.studentNotes}</div>
              <div style={{ fontSize:10, color:nsColor[noteStatus], transition:"color .3s" }}>{nsLabel[noteStatus]}</div>
            </div>
            {!noteLoaded
              ? <div style={{ color:T.textDim, fontSize:12, padding:"20px 0" }}>{L.fetchingNote}</div>
              : <textarea value={note} onChange={e=>handleNoteChange(e.target.value)}
                  placeholder={`Notes about ${s.name}...`}
                  style={{ width:"100%", minHeight:280, background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:8, color:T.textMid, padding:"14px", fontSize:13, lineHeight:1.7, resize:"vertical", outline:"none", fontFamily:"'DM Mono',monospace", boxSizing:"border-box" }}/>
            }
            <div style={{ fontSize:10, color:T.textGhost, marginTop:8 }}>{L.noteSavedTo} <code style={{ color:T.textDim }}>{s.name}/notes.txt</code></div>
          </div>
        )}

        {activeTab==="files" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:10, color:T.textFaint, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>{L.studentFiles}</div>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{ background:T.bgPanel, border:`1px solid ${T.borderInput}`, color:uploading?T.textDim:T.textSub, borderRadius:5, padding:"6px 14px", cursor:uploading?"wait":"pointer", fontSize:11, fontWeight:700, letterSpacing:"0.06em", fontFamily:"inherit" }}>{uploading?L.uploading:L.upload}</button>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileUpload} style={{ display:"none" }}/>
            {uploaded.length===0
              ? <div onClick={()=>fileRef.current?.click()} style={{ border:`1px dashed ${T.borderMid}`, borderRadius:8, padding:"40px 20px", textAlign:"center", cursor:"pointer", color:T.textDim, fontSize:12, lineHeight:2 }}>
                  <div style={{ fontSize:22, marginBottom:8, color:T.border }}>&#x2B06;</div>
                  {L.uploadPrompt}<br/>
                  <span style={{ fontSize:11, color:T.textGhost }}>{L.uploadSub} <code>{s.name}/photos/</code></span>
                </div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {uploaded.map((file,i)=>(
                    <div key={i} style={{ background:T.bgAlt, border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:38, height:38, background:T.bgPanel, border:`1px solid ${T.borderMid}`, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:T.textFaint, flexShrink:0 }}>{fileIcon(file.originalname||file.filename)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:T.textMid, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.originalname||file.filename}</div>
                        <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{formatBytes(file.size)}</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>fileRef.current?.click()} style={{ background:"none", border:`1px dashed ${T.borderMid}`, color:T.textDim, borderRadius:6, padding:"10px", cursor:"pointer", fontSize:11, fontFamily:"inherit", marginTop:4 }}>{L.addMore}</button>
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [themeName,   setThemeName]   = useState("dark");
  const [lang,        setLang]        = useState("en");
  const T = THEMES[themeName];
  const L = STRINGS[lang];

  const [students,    setStudents]    = useState([]);
  const [loadState,   setLoadState]   = useState("loading");
  const [rootDir,     setRootDir]     = useState("D:/JudoDojo");
  const [search,      setSearch]      = useState("");
  const [beltFilter,  setBeltFilter]  = useState("All");
  const [paidFilter,  setPaidFilter]  = useState("All");
  const [classFilter, setClassFilter] = useState("All");
  const [tab,         setTab]         = useState("roster");
  const [formOpen,    setFormOpen]    = useState(false);
  const [formInit,    setFormInit]    = useState(null);
  const [formKey,     setFormKey]     = useState(0);
  const [formSaving,  setFormSaving]  = useState(false);
  const [selectedId,  setSelectedId]  = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [notifSent,   setNotifSent]   = useState({});
  const [toast,       setToast]       = useState({ message:"", type:"ok" });
  const [settingsOpen,setSettingsOpen]= useState(false);

  const today = new Date();
  const isAfter5th = today.getDate() >= 5;

  function showToast(msg, type="ok", dur=3000) {
    setToast({message:msg,type});
    setTimeout(()=>setToast({message:"",type:"ok"}),dur);
  }

  async function loadStudents() {
    setLoadState("loading");
    try { setStudents(Array.isArray(await api.getStudents()?await api.getStudents():[]) ); setLoadState("ok"); }
    catch { setLoadState("error"); }
  }
  // cleaner version:
  async function fetchStudents() {
    setLoadState("loading");
    try {
      const data = await api.getStudents();
      setStudents(Array.isArray(data) ? data : []);
      setLoadState("ok");
    } catch { setLoadState("error"); }
  }
  useEffect(() => { fetchStudents(); }, []);

  const saveStudent = useCallback(async (f) => {
    if (!f.name.trim()) { showToast(L.toastNameReq,"error"); return; }
    setFormSaving(true);
    const s = { ...f, age:Number(f.age), fee:Number(f.fee), progress:Number(f.progress), points:Number(f.points) };
    try {
      if (formInit?.name) {
        await api.updateStudent(formInit.name, s);
        setStudents(ss => ss.map(x => x.name===formInit.name ? s : x));
        if (selectedId===formInit.name) setSelectedId(s.name);
        showToast(L.toastUpdated);
      } else {
        await api.createStudent(s);
        setStudents(ss => [...ss, s]);
        setSelectedId(s.name);
        showToast(L.toastCreated);
      }
      setFormOpen(false);
    } catch { showToast(L.toastSaveErr,"error"); }
    finally { setFormSaving(false); }
  }, [formInit, selectedId, L]);

  const deleteStudent = useCallback(async (name) => {
    setDeleting(true);
    try {
      await api.deleteStudent(name);
      setStudents(ss => ss.filter(s=>s.name!==name));
      setDeleteTarget(null);
      if (selectedId===name) setSelectedId(null);
      showToast(L.toastDeleted);
    } catch { showToast(L.toastDelErr,"error"); }
    finally { setDeleting(false); }
  }, [selectedId, L]);

  const toggleField = useCallback(async (name, field) => {
    setStudents(ss => {
      const updated = ss.map(s=>s.name===name?{...s,[field]:!s[field]}:s);
      const student = updated.find(s=>s.name===name);
      if (student) api.updateStudent(name,student).catch(()=>showToast(L.toastSyncErr,"warn"));
      return updated;
    });
  }, [L]);

  const progressTimer = useRef(null);
  const setProgress = useCallback((name, field, val) => {
    setStudents(ss => ss.map(s=>s.name===name?{...s,[field]:val}:s));
    clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(()=>{
      setStudents(ss=>{
        const student=ss.find(s=>s.name===name);
        if(student) api.updateStudent(name,student).catch(()=>showToast(L.toastSyncErr,"warn"));
        return ss;
      });
    },500);
  }, [L]);

  async function applyRootDir(path) {
    try {
      await api.setRootDir(path);
      setRootDir(path);
      showToast(`${L.toastRootSet} ${path}`);
      await fetchStudents();
    } catch { showToast(L.toastRootErr,"error"); }
  }

  // Direct student update used by PaymentsTab (updates profile.json + local state)
  const updateStudentDirect = useCallback(async (updatedStudent) => {
    await api.updateStudent(updatedStudent.name, updatedStudent);
    setStudents(ss => ss.map(s => s.name === updatedStudent.name ? updatedStudent : s));
  }, []);
    const q = search.toLowerCase();
    return (!q||s.name.toLowerCase().includes(q)||(s.phone||"").includes(q))
      && (beltFilter==="All"||s.belt===beltFilter)
      && (paidFilter==="All"||(paidFilter==="Paid"?s.paid:!s.paid))
      && (classFilter==="All"||s.judoClass===classFilter);
  }), [students,search,beltFilter,paidFilter,classFilter]);

  const selected = students.find(s=>s.name===selectedId)||null;
  const unpaid   = students.filter(s=>!s.paid);
  const stats    = useMemo(()=>({
    total:   students.length,
    paid:    students.filter(s=>s.paid).length,
    insured: students.filter(s=>s.insured).length,
    kata:    students.filter(s=>s.kata).length,
    revenue: students.filter(s=>s.paid).reduce((a,s)=>a+Number(s.fee),0),
    avgProg: students.length?Math.round(students.reduce((a,s)=>a+s.progress,0)/students.length):0,
  }),[students]);

  function openNewForm()  { setFormInit(null); setFormKey(k=>k+1); setFormOpen(true); }
  function openEditForm(s){ setFormInit(s);    setFormKey(k=>k+1); setFormOpen(true); }

  const inp = { background:T.bgInput, border:`1px solid ${T.borderInput}`, borderRadius:5, color:T.text, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" };

  const navItem = (label, id) => (
    <button key={id} onClick={()=>setTab(id)} style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 24px", background:tab===id?T.bgHover:"none", border:"none", borderLeft:`2px solid ${tab===id?T.accent:"transparent"}`, color:tab===id?T.text:T.textFaint, cursor:"pointer", fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"inherit", transition:"all .15s" }}>{label}</button>
  );
  const filterSel = (val, set, options) => (
    <select value={val} onChange={e=>set(e.target.value)} style={{...inp,cursor:"pointer",color:T.textSub}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  );

  return (
    <ThemeCtx.Provider value={T}>
      <LangCtx.Provider value={L}>
        <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Mono','Consolas',monospace" }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
            * { box-sizing:border-box; margin:0; padding:0; }
            ::-webkit-scrollbar { width:4px; }
            ::-webkit-scrollbar-track { background:transparent; }
            ::-webkit-scrollbar-thumb { background:${T.scrollThumb}; border-radius:2px; }
            input,select,textarea { color-scheme:${T.inputColorScheme}; }
            input:focus,select:focus,textarea:focus { border-color:${T.textDim} !important; }
            .trow { transition:background .12s; cursor:pointer; }
            .trow:hover { background:${T.trowHover} !important; }
            .trow.sel { background:${T.trowSel} !important; border-left:2px solid ${T.accent} !important; }
            button:active { opacity:.8; }
            a:active { opacity:.8; }
            @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
            code { font-family:inherit; }
          `}</style>

          {/* HEADER */}
          <div style={{ height:56, background:T.headerBg, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 28px", position:"sticky", top:0, zIndex:100, boxShadow:themeName==="light"?"0 1px 3px rgba(0,0,0,.08)":"none" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:T.text, letterSpacing:0.5, marginRight:"auto" }}>
              {L.appTitle} &mdash; <span style={{ color:T.textFaint, fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:400 }}>{L.appSub}</span>
            </div>
            {/* Server status */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginRight:20 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block", background:loadState==="ok"?"#3db870":loadState==="loading"?"#e8c84a":"#c04040" }}/>
              <span style={{ fontSize:10, color:T.textDim, letterSpacing:"0.08em" }}>
                {loadState==="ok"?L.serverConnected:loadState==="loading"?L.serverConnecting:L.serverOffline}
              </span>
              {loadState==="error" && <button onClick={fetchStudents} style={{ background:"none", border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:10, fontFamily:"inherit", marginLeft:4 }}>{L.retry}</button>}
            </div>
            {isAfter5th && unpaid.length>0 && (
              <div style={{ background:"#1e0f0f", border:"1px solid #c0392b44", borderRadius:5, padding:"5px 14px", fontSize:11, color:"#c07070", fontWeight:700, letterSpacing:"0.06em", marginRight:14 }}>
                {unpaid.length} {L.unpaidBanner}
              </div>
            )}
            {/* Settings button */}
            <button onClick={()=>setSettingsOpen(true)} style={{ background:"none", border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:6, padding:"7px 14px", cursor:"pointer", fontSize:11, fontWeight:700, letterSpacing:"0.06em", fontFamily:"inherit", marginRight:10 }}>
              &#9881; {L.settings}
            </button>
            <button onClick={openNewForm} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:12, letterSpacing:"0.06em", fontFamily:"inherit" }}>{L.newStudent}</button>
          </div>

          <div style={{ display:"flex", height:"calc(100vh - 56px)" }}>

            {/* SIDEBAR */}
            <div style={{ width:220, flexShrink:0, background:T.bgPanel, borderRight:`1px solid ${T.border}`, padding:"20px 0", display:"flex", flexDirection:"column", overflowY:"auto" }}>
              <div style={{ padding:"0 24px 16px", fontSize:10, color:T.textGhost, fontWeight:700, letterSpacing:"0.12em" }}>NAVIGATION</div>
              {navItem(L.navRoster,    "roster")}
              {navItem(L.navDashboard, "dashboard")}

              <div style={{ marginTop:28, padding:"0 24px 12px", fontSize:10, color:T.textGhost, fontWeight:700, letterSpacing:"0.12em" }}>{L.quickStats}</div>
              {[[L.students,stats.total],[L.paid,`${stats.paid}/${stats.total}`],[L.insured,stats.insured],[L.kata,stats.kata]].map(([l,v])=>(
                <div key={l} style={{ padding:"8px 24px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:T.textDim }}>{l}</span>
                  <span style={{ fontSize:12, color:T.textSub, fontWeight:600 }}>{v}</span>
                </div>
              ))}

              <div style={{ flex:1 }}/>
              <div style={{ padding:"16px 24px", borderTop:`1px solid ${T.borderSub}` }}>
                <div style={{ fontSize:10, color:T.textGhost, marginBottom:4, letterSpacing:"0.08em" }}>{L.monthlyRevenue}</div>
                <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>MAD {stats.revenue.toLocaleString()}</div>
              </div>
            </div>

            {/* MAIN */}
            <div style={{ flex:1, overflowY:"auto", padding:28 }}>

              {loadState==="loading" && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60%", color:T.textDim, fontSize:13, letterSpacing:"0.1em" }}>{L.loadingStudents}</div>}

              {loadState==="error" && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:16, textAlign:"center" }}>
                  <div style={{ fontSize:13, color:"#c07070" }}>{L.serverError}</div>
                  <div style={{ fontSize:11, color:T.textFaint, lineHeight:1.8 }}>{L.serverErrorSub} <code style={{ color:T.textSub }}>localhost:3001</code><br/>Run: <code style={{ color:T.textSub }}>node server.js</code> {L.serverErrorRun}</div>
                  <button onClick={fetchStudents} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:6, padding:"9px 24px", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit" }}>{L.retryConn}</button>
                </div>
              )}

              {/* ROSTER */}
              {loadState==="ok" && tab==="roster" && (<>
                <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
                  <div style={{ flex:"1 1 200px", minWidth:160 }}>
                    <input placeholder={L.searchPlaceholder} value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,width:"100%",padding:"8px 12px"}}/>
                  </div>
                  {filterSel(beltFilter,  setBeltFilter,  [{value:"All",label:L.allBelts},   ...BELTS.map(b=>({value:b.name,label:b.name}))])}
                  {filterSel(paidFilter,  setPaidFilter,  [{value:"All",label:L.allStatus},   {value:"Paid",label:L.paidLabel},{value:"Unpaid",label:L.unpaidLabel}])}
                  {filterSel(classFilter, setClassFilter, [{value:"All",label:L.allClasses},  ...CLASSES.map(c=>({value:c,label:c}))])}
                  <span style={{ fontSize:11, color:T.textDim, marginLeft:"auto" }}>{filtered.length} {filtered.length===1?L.student:L.studentsPlural}</span>
                </div>
                <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden", background:T.bgPanel }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:T.bgAlt, borderBottom:`1px solid ${T.border}` }}>
                        {[L.colStudent,L.colClass,L.colBelt,L.colProgress,L.colPaid,L.colInsured,L.colKata,L.colFee].map(h=>(
                          <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:10, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", borderRight:`1px solid ${T.borderSub}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length===0 && <tr><td colSpan={8} style={{ padding:48, textAlign:"center", color:T.textGhost, fontSize:13 }}>{L.noMatch}</td></tr>}
                      {filtered.map(s=>(
                        <tr key={s.name} className={`trow${selectedId===s.name?" sel":""}`}
                          onClick={()=>setSelectedId(s.name===selectedId?null:s.name)}
                          style={{ borderBottom:`1px solid ${T.borderSub}`, borderLeft:selectedId===s.name?`2px solid ${T.accent}`:"2px solid transparent" }}>
                          <td style={{ padding:"12px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <Avatar src={s.photo} name={s.name} size={30}/>
                              <div>
                                <div style={{ fontWeight:600, color:T.textMid, fontSize:13 }}>{s.name}</div>
                                <div style={{ fontSize:11, color:T.textDim, marginTop:1 }}>Age {s.age}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px" }}><ClassChip cls={s.judoClass}/></td>
                          <td style={{ padding:"12px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <BeltPip belt={s.belt} size={13}/>
                              <span style={{ fontSize:12, color:T.textSub }}>{s.belt}</span>
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px", minWidth:120 }}><ProgressBar value={s.progress}/></td>
                          <td style={{ padding:"12px 14px" }} onClick={e=>{e.stopPropagation();toggleField(s.name,"paid");}}>
                            <StatusDot on={s.paid} label={s.paid?L.paidLabel:L.unpaidLabel}/>
                          </td>
                          <td style={{ padding:"12px 14px" }} onClick={e=>{e.stopPropagation();toggleField(s.name,"insured");}}>
                            <StatusDot on={s.insured} label={s.insured?L.yesLabel:L.noLabel}/>
                          </td>
                          <td style={{ padding:"12px 14px" }} onClick={e=>{e.stopPropagation();toggleField(s.name,"kata");}}>
                            <StatusDot on={s.kata} label={s.kata?L.passLabel:"—"}/>
                          </td>
                          <td style={{ padding:"12px 14px", color:T.textSub, fontSize:13, fontVariantNumeric:"tabular-nums" }}>MAD {s.fee}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>)}

              {/* DASHBOARD */}
              {loadState==="ok" && tab==="dashboard" && (<>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.textMid, marginBottom:24, fontWeight:700 }}>{L.dashTitle}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
                  {[
                    {label:L.statTotal,   value:stats.total,                    sub:L.statTotalSub},
                    {label:L.statPaid,    value:`${stats.paid}/${stats.total}`,  sub:`MAD ${stats.revenue.toLocaleString()}`},
                    {label:L.statInsured, value:stats.insured,                  sub:`${stats.total-stats.insured} ${L.statUninsured}`},
                    {label:L.statKata,    value:stats.kata,                     sub:L.statKataSub},
                    {label:L.statProgress,value:`${stats.avgProg}%`,            sub:L.statProgressSub},
                    {label:L.statUnpaid,  value:unpaid.length,                  sub:isAfter5th?L.statPastDue:L.statGrace, alert:unpaid.length>0&&isAfter5th},
                  ].map(c=>(
                    <div key={c.label} style={{ background:c.alert?"#180d0d":T.bgPanel, border:`1px solid ${c.alert?"#3a1515":T.border}`, borderRadius:8, padding:"20px 22px" }}>
                      <div style={{ fontSize:10, color:c.alert?"#7a4040":T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{c.label}</div>
                      <div style={{ fontSize:28, fontWeight:700, color:c.alert?"#c07070":T.text, fontFamily:"'Cormorant Garamond',serif" }}>{c.value}</div>
                      <div style={{ fontSize:11, color:c.alert?"#7a4040":T.textDim, marginTop:4 }}>{c.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:T.bgPanel, border:`1px solid ${T.border}`, borderRadius:8, padding:"20px 22px", marginBottom:20 }}>
                  <div style={{ fontSize:10, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16 }}>{L.beltDist}</div>
                  <div style={{ display:"flex", gap:2, height:28, borderRadius:4, overflow:"hidden", marginBottom:14 }}>
                    {BELTS.map(b=>{const c=students.filter(s=>s.belt===b.name).length;if(!c)return null;return<div key={b.name} style={{flex:c,background:b.hex,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:b.dark?"#fff":"#1a1a1a",minWidth:0,overflow:"hidden"}}>{c}</div>;})}
                  </div>
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                    {BELTS.map(b=><div key={b.name} style={{display:"flex",alignItems:"center",gap:6}}><BeltPip belt={b.name} size={10}/><span style={{fontSize:11,color:T.textFaint}}>{b.name} ({students.filter(s=>s.belt===b.name).length})</span></div>)}
                  </div>
                </div>

                <div style={{ background:T.bgPanel, border:`1px solid ${T.border}`, borderRadius:8, padding:"20px 22px", marginBottom:20 }}>
                  <div style={{ fontSize:10, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16 }}>{L.classDist}</div>
                  <div style={{ display:"flex", gap:14 }}>
                    {CLASSES.map(cls=>(
                      <div key={cls} style={{ flex:1, background:T.bgAlt, border:`1px solid ${T.border}`, borderRadius:6, padding:"16px" }}>
                        <ClassChip cls={cls}/>
                        <div style={{ fontSize:28, fontWeight:700, color:T.textMid, fontFamily:"'Cormorant Garamond',serif", marginTop:10 }}>{students.filter(s=>s.judoClass===cls).length}</div>
                        <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{L.studentsPlural}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {unpaid.length>0 && (
                  <div style={{ background:"#100a0a", border:"1px solid #2a1515", borderRadius:8, padding:"20px 22px" }}>
                    <div style={{ fontSize:10, color:"#7a4040", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>
                      {L.unpaidTitle} {isAfter5th?L.actionRequired:L.gracePeriod}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {unpaid.map(s=>(
                        <div key={s.name} style={{ background:"#0f0a0a", border:"1px solid #251515", borderRadius:6, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <Avatar src={s.photo} name={s.name} size={32}/>
                            <div>
                              <div style={{ fontWeight:600, color:"#c0c0c0", fontSize:13 }}>{s.name}</div>
                              <div style={{ fontSize:11, color:"#504040", marginTop:2 }}>{s.phone} &middot; {s.judoClass} &middot; MAD {s.fee}</div>
                            </div>
                          </div>
                          <a href={waURL(s.phone,s.name,lang)} target="_blank" rel="noopener noreferrer"
                            onClick={()=>setNotifSent(n=>({...n,[s.name]:true}))}
                            style={{ background:notifSent[s.name]?"#1a2e1a":"#128C7E", color:notifSent[s.name]?"#4a9a4a":"#fff", borderRadius:5, padding:"7px 16px", fontWeight:700, fontSize:11, textDecoration:"none", whiteSpace:"nowrap", letterSpacing:"0.05em", border:"1px solid transparent", transition:"all .2s" }}>
                            {notifSent[s.name]?L.whatsappSent:L.whatsappBtn}
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
              <div style={{ width:370, flexShrink:0, background:T.bgPanel, borderLeft:`1px solid ${T.border}`, overflowY:"auto" }}>
                <DetailPanel
                  key={selected.name}
                  student={selected}
                  onClose={()=>setSelectedId(null)}
                  onEdit={()=>openEditForm(selected)}
                  onDelete={()=>setDeleteTarget(selected.name)}
                  onToggle={field=>toggleField(selected.name,field)}
                  onProgress={(field,val)=>setProgress(selected.name,field,val)}
                  notifSent={notifSent[selected.name]}
                  onNotif={()=>setNotifSent(n=>({...n,[selected.name]:true}))}
                  lang={lang}
                  onUpdateStudent={updateStudentDirect}
                  allStudents={students}
                />
              </div>
            )}
          </div>

          {/* FORM MODAL */}
          <Modal open={formOpen} onClose={()=>!formSaving&&setFormOpen(false)} width={600}>
            <StudentForm key={formKey} initial={formInit} onSave={saveStudent} onCancel={()=>setFormOpen(false)} saving={formSaving} lang={lang}/>
          </Modal>

          {/* DELETE CONFIRM */}
          <Modal open={!!deleteTarget} onClose={()=>!deleting&&setDeleteTarget(null)} width={400}>
            <div style={{ padding:32, textAlign:"center" }}>
              <div style={{ fontSize:13, color:"#c07070", fontWeight:700, letterSpacing:"0.08em", marginBottom:12 }}>{L.confirmDelete}</div>
              <div style={{ color:T.textSub, fontSize:13, marginBottom:8, lineHeight:1.6 }}>{L.deleteWarning}</div>
              <div style={{ color:T.text, fontWeight:700, fontSize:14, marginBottom:16 }}>{deleteTarget}</div>
              <div style={{ color:T.textSub, fontSize:13, marginBottom:28, lineHeight:1.6 }}>{L.deleteWarning2}</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={()=>setDeleteTarget(null)} disabled={deleting} style={{ background:"none", border:`1px solid ${T.borderInput}`, color:T.textSub, borderRadius:6, padding:"9px 24px", cursor:"pointer", fontSize:13, fontFamily:"inherit", opacity:deleting?.5:1 }}>{L.cancel}</button>
                <button onClick={()=>deleteStudent(deleteTarget)} disabled={deleting} style={{ background:deleting?"#7a2020":T.accent, border:"none", color:"#fff", borderRadius:6, padding:"9px 28px", cursor:deleting?"wait":"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", minWidth:80 }}>
                  {deleting?L.deleting:L.delete}
                </button>
              </div>
            </div>
          </Modal>

          {/* SETTINGS MODAL */}
          <SettingsModal
            open={settingsOpen}
            onClose={()=>setSettingsOpen(false)}
            rootDir={rootDir}
            onApplyRoot={async(p)=>{ await applyRootDir(p); }}
            themeName={themeName}
            onTheme={setThemeName}
            lang={lang}
            onLang={setLang}
          />

          <Toast message={toast.message} type={toast.type}/>
        </div>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}
