import OpenAI from "https://cdn.jsdelivr.net/npm/openai@7.56.0/+esm";

// ---------- Stockage local (navigateur uniquement) ----------
const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem("candid:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("candid:" + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Réglages ----------
const settingIds = ["apiKey", "model", "gmailAccount", "language", "extra", "signature"];
for (const id of settingIds) {
  const el = $("#" + id);
  const saved = store.get(id);
  if (saved !== null) el.value = saved;
  el.addEventListener("input", () => { store.set(id, el.value); refreshAllLinks(); });
  el.addEventListener("change", () => { store.set(id, el.value); refreshAllLinks(); });
}

// La clé n'est jamais affichée en clair : champ masqué, pas de bouton « afficher ».
const keyInput = $("#apiKey");
function renderKeyStatus() {
  const has = keyInput.value.trim().length > 0;
  $("#keyStatus").textContent = has ? "Clé enregistrée dans ce navigateur ✓" : "Aucune clé enregistrée.";
  $("#clearKey").classList.toggle("hidden", !has);
}
keyInput.addEventListener("input", renderKeyStatus);
for (const t of ["copy", "cut", "dragstart"]) keyInput.addEventListener(t, (e) => e.preventDefault());
$("#clearKey").addEventListener("click", () => {
  keyInput.value = "";
  store.set("apiKey", "");
  renderKeyStatus();
});
renderKeyStatus();

let cv = store.get("cv"); // { name, data (base64) }
function renderCvStatus() {
  $("#cvStatus").textContent = cv ? `CV chargé : ${cv.name}` : "Aucun CV chargé.";
  $("#cvStatus").classList.toggle("muted", !cv);
}
renderCvStatus();

$("#cvFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  cv = { name: file.name, data: btoa(bin) };
  if (!store.set("cv", cv)) alert("CV chargé pour cette session, mais trop gros pour être mémorisé dans le navigateur.");
  renderCvStatus();
});

// ---------- Import CSV ----------
const FIELDS = {
  company: /entreprise|societe|company|organi[sz]ation|raison sociale|^nom$|^name$|structure|startup|employeur|marque|brand/,
  email: /mail|courriel/,
  contact: /contact|prenom|first|interlocuteur|destinataire|recruteur|full ?name|nom complet|personne/,
  website: /site|web|url|domaine|domain|linkedin/,
  notes: /note|poste|role|job|commentaire|comment|description|secteur|industrie|industry|ville|city/,
};
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

let headers = [];
let rows = [];
let mapping = {};
const results = store.get("results", {}); // companyKey -> { subject, body, summary, sources, to }

const drop = $("#drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) loadCsv(e.dataTransfer.files[0]); });
$("#csvFile").addEventListener("change", (e) => { if (e.target.files[0]) loadCsv(e.target.files[0]); });

async function loadCsv(file) {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // CSV Excel FR
  text = text.replace(/^﻿/, "");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  headers = parsed.meta.fields.filter(Boolean);
  rows = parsed.data;
  if (!headers.length || !rows.length) { alert("Ce CSV semble vide."); return; }
  autoMap();
  renderMapping();
  renderList();
}

function autoMap() {
  mapping = {};
  const used = new Set();
  for (const field of ["email", "website", "company", "contact", "notes"]) {
    const h = headers.find((h) => !used.has(h) && FIELDS[field].test(norm(h)));
    if (h) { mapping[field] = h; used.add(h); }
  }
  if (!mapping.company) mapping.company = headers.find((h) => !used.has(h)) || headers[0];
}

function renderMapping() {
  $("#mapping").classList.remove("hidden");
  for (const sel of $$("#mapping select")) {
    const field = sel.dataset.map;
    sel.innerHTML = "";
    if (field !== "company") sel.add(new Option("— aucune —", ""));
    for (const h of headers) sel.add(new Option(h, h));
    sel.value = mapping[field] || "";
    sel.onchange = () => { mapping[field] = sel.value; renderList(); };
  }
}

const cell = (row, field) => (mapping[field] ? String(row[mapping[field]] ?? "").trim() : "");
const keyOf = (row) => norm(cell(row, "company")) + "|" + norm(cell(row, "email"));

// ---------- Liste ----------
const items = []; // { row, el, controller }

function renderList() {
  const list = $("#list");
  list.innerHTML = "";
  items.length = 0;
  const valid = rows.filter((r) => cell(r, "company"));
  $("#results").classList.remove("hidden");
  $("#count").textContent = `(${valid.length})`;

  for (const row of valid) {
    const el = $("#rowTpl").content.firstElementChild.cloneNode(true);
    const item = { row, el, controller: null };
    items.push(item);

    $(".co", el).textContent = cell(row, "company");
    $(".meta", el).textContent = [cell(row, "contact"), cell(row, "email"), cell(row, "website"), cell(row, "notes")]
      .filter(Boolean).join(" · ") || "—";
    $(".to", el).value = cell(row, "email");

    $(".gen", el).addEventListener("click", () => generate(item));
    for (const f of [".to", ".subject", ".body"]) {
      $(f, el).addEventListener("input", () => { saveEdits(item); refreshLink(item); });
    }
    $(".copy", el).addEventListener("click", async () => {
      await navigator.clipboard.writeText(`${$(".subject", el).value}\n\n${$(".body", el).value}`);
      $(".copy", el).textContent = "Copié !";
      setTimeout(() => ($(".copy", el).textContent = "Copier le texte"), 1500);
    });

    const saved = results[keyOf(row)];
    if (saved) showResult(item, saved);
    list.appendChild(el);
  }
}

function setStatus(item, text, kind = "") {
  const s = $(".status", item.el);
  s.textContent = text;
  s.className = "status " + kind;
}

function showResult(item, r) {
  const el = item.el;
  $(".item-body", el).classList.remove("hidden");
  $(".subject", el).value = r.subject || "";
  $(".body", el).value = r.body || "";
  if (r.to) $(".to", el).value = r.to;
  $(".summary", el).textContent = r.summary || "—";
  const ul = $(".sources", el);
  ul.innerHTML = "";
  for (const s of r.sources || []) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = s.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = s.title || s.url;
    li.appendChild(a);
    ul.appendChild(li);
  }
  $(".gen", el).textContent = "Régénérer";
  setStatus(item, "Prêt", "ok");
  refreshLink(item);
}

function saveEdits(item) {
  const k = keyOf(item.row);
  if (!results[k]) return;
  results[k].subject = $(".subject", item.el).value;
  results[k].body = $(".body", item.el).value;
  results[k].to = $(".to", item.el).value;
  store.set("results", results);
}

// ---------- Lien Gmail ----------
function gmailUrl(to, subject, body) {
  const enc = encodeURIComponent;
  let url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
  const account = $("#gmailAccount").value.trim();
  if (account) url += `&authuser=${enc(account)}`;
  return url;
}

function refreshLink(item) {
  const el = item.el;
  const url = gmailUrl($(".to", el).value.trim(), $(".subject", el).value, $(".body", el).value);
  $(".gmail", el).href = url;
  const len = $(".len", el);
  len.textContent = url.length > 7500 ? "⚠ Message long : Gmail risque de le tronquer, raccourcissez-le." : "";
}
function refreshAllLinks() { items.forEach((i) => results[keyOf(i.row)] && refreshLink(i)); }

// ---------- Génération (API OpenAI + recherche web) ----------
function buildSystem() {
  const lang = $("#language").value;
  const langRule = {
    auto: "Écris dans la langue la plus naturelle pour l'entreprise : français pour une entreprise francophone, anglais sinon.",
    fr: "Écris en français.",
    en: "Écris en anglais.",
  }[lang];
  const extra = $("#extra").value.trim();

  return `Tu aides un candidat à écrire des candidatures spontanées par e-mail. Son CV est joint en PDF.

Pour l'entreprise indiquée :
1. Fais quelques recherches web ciblées : activité, produits ou services, clients, actualités des 12 derniers mois (levées, lancements, recrutements), culture, et ce qui touche à l'IA ou aux sujets proches du profil du candidat. Vérifie que tu parles bien de la bonne entreprise (aide-toi du site web s'il est fourni). Arrête-toi dès que tu as assez de matière.
2. Rédige un e-mail de candidature spontanée qui relie précisément le parcours du CV à des faits concrets trouvés sur l'entreprise.

Règles de rédaction :
- 150 à 250 mots, texte brut, sans markdown, sans liens ni références de sources.
- Une accroche propre à l'entreprise (pas de formule générique), puis 2 ou 3 apports concrets du candidat tirés du CV, puis une proposition simple (un échange de 20 minutes) et la mention du CV en pièce jointe.
- N'invente rien : aucun fait sur le candidat absent du CV, aucun fait sur l'entreprise absent de tes recherches. Si tes recherches ne donnent rien de fiable, écris une candidature plus générale et dis-le dans la synthèse.
- Vouvoiement. Si le nom du contact est connu, commence par « Bonjour Prénom Nom, », sinon par « Bonjour, ».
- Termine par une formule de politesse courte (ex. « Bien cordialement, ») sans signature : elle est ajoutée automatiquement.
- Objet court et spécifique (pas seulement « Candidature spontanée »).
- ${langRule}
${extra ? `\nConsignes du candidat (prioritaires sur les règles ci-dessus en cas de conflit) :\n${extra}\n` : ""}
Réponds à la fin exactement dans ce format, sans rien d'autre autour :
<recherche>
Synthèse de ce que tu as appris sur l'entreprise, en 3 à 6 tirets courts.
</recherche>
<objet>Objet de l'e-mail</objet>
<message>
Corps de l'e-mail
</message>`;
}

function companyBrief(row) {
  const lines = [`Entreprise : ${cell(row, "company")}`];
  if (cell(row, "website")) lines.push(`Site web : ${cell(row, "website")}`);
  if (cell(row, "contact")) lines.push(`Contact : ${cell(row, "contact")}`);
  if (cell(row, "email")) lines.push(`E-mail du contact : ${cell(row, "email")}`);
  if (cell(row, "notes")) lines.push(`Notes : ${cell(row, "notes")}`);
  // Autres colonnes du CSV, pour le contexte
  for (const h of headers) {
    if (Object.values(mapping).includes(h)) continue;
    const v = String(row[h] ?? "").trim();
    if (v) lines.push(`${h} : ${v}`);
  }
  return lines.join("\n");
}

async function callOpenAI(item, onProgress) {
  const client = new OpenAI({ apiKey: $("#apiKey").value.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 });
  const stream = await client.responses.create(
    {
      model: $("#model").value,
      instructions: buildSystem(),
      // Consignes et CV en premier (identiques d'une entreprise à l'autre) : le cache d'OpenAI les réutilise.
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", filename: cv.name || "cv.pdf", file_data: `data:application/pdf;base64,${cv.data}` },
            { type: "input_text", text: companyBrief(item.row) },
          ],
        },
      ],
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      reasoning: { effort: "medium" },
      max_output_tokens: 16000,
      store: false,
      stream: true,
    },
    { signal: item.controller.signal },
  );

  let final = null;
  for await (const ev of stream) {
    if (ev.type === "response.web_search_call.in_progress") onProgress("search");
    else if (ev.type === "response.output_text.delta") onProgress("text");
    else if (ev.type === "response.reasoning_summary_part.added" || ev.type === "response.reasoning_text.delta") onProgress("thinking");
    else if (ev.type === "response.completed" || ev.type === "response.incomplete") final = ev.response;
    else if (ev.type === "response.failed") throw new Error(ev.response?.error?.message || "La génération a échoué.");
    else if (ev.type === "error") throw new Error(ev.message || "Erreur pendant la génération.");
  }
  if (!final) throw new Error("Réponse interrompue, réessayez.");
  if (final.status === "incomplete") {
    const why = final.incomplete_details?.reason;
    throw new Error(why === "max_output_tokens" ? "Réponse tronquée (limite de longueur)." : why === "content_filter" ? "Réponse bloquée par le filtre de contenu." : "Réponse incomplète, réessayez.");
  }
  return final.output || [];
}

function parseOutput(output) {
  const parts = output.filter((o) => o.type === "message").flatMap((o) => o.content || []);
  const refusal = parts.find((c) => c.type === "refusal");
  const text = parts.filter((c) => c.type === "output_text").map((c) => c.text).join("");
  if (!text && refusal) throw new Error("Le modèle a refusé cette demande.");
  const grab = (tag) => {
    const all = [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
    return all.length ? all[all.length - 1][1].trim() : "";
  };
  const subject = grab("objet");
  const body = grab("message");
  if (!subject || !body) throw new Error("Réponse inattendue du modèle, réessayez.");

  // Sources : d'abord celles citées, sinon celles consultées par la recherche web
  const seen = new Map();
  for (const c of parts) {
    for (const a of c.annotations || []) {
      if (a.type === "url_citation" && a.url && !seen.has(a.url)) seen.set(a.url, { url: a.url, title: a.title });
    }
  }
  if (!seen.size) {
    for (const o of output) {
      if (o.type !== "web_search_call") continue;
      for (const src of o.action?.sources || []) if (src.url && !seen.has(src.url)) seen.set(src.url, { url: src.url, title: src.title });
    }
  }
  return { subject, body, summary: grab("recherche"), sources: [...seen.values()].slice(0, 8) };
}

// Les erreurs de /v1/responses (ex. 401) n'ont pas d'en-tête CORS : le navigateur ne voit
// qu'une « erreur de connexion ». /v1/models, lui, en a un : on s'en sert pour diagnostiquer.
async function diagnose(err) {
  if (!(err instanceof OpenAI.APIConnectionError) || err instanceof OpenAI.APIUserAbortError) return err;
  try {
    const client = new OpenAI({ apiKey: $("#apiKey").value.trim(), dangerouslyAllowBrowser: true, maxRetries: 0 });
    await client.models.retrieve($("#model").value);
    return err;
  } catch (e) {
    return e instanceof OpenAI.APIConnectionError ? err : e;
  }
}

function errorMessage(err) {
  if (err instanceof OpenAI.NotFoundError) return "Modèle indisponible pour cette clé : essayez l'autre modèle.";
  if (err instanceof OpenAI.APIUserAbortError || err?.name === "AbortError") return "Arrêté.";
  if (err instanceof OpenAI.AuthenticationError) return "Clé API invalide.";
  if (err instanceof OpenAI.PermissionDeniedError) return "Accès refusé (vérifiez les droits de la clé sur platform.openai.com).";
  if (err instanceof OpenAI.RateLimitError) return /quota/i.test(err.message) ? "Crédit OpenAI épuisé : vérifiez la facturation." : "Limite de débit atteinte, réessayez dans un instant.";
  if (err instanceof OpenAI.APIConnectionError) return "Connexion impossible à l'API.";
  if (err instanceof OpenAI.APIError) return `Erreur API ${err.status ?? ""} : ${err.error?.message || err.message}`;
  return err?.message || String(err);
}

function ready() {
  if (!$("#apiKey").value.trim()) { alert("Ajoutez votre clé API OpenAI dans les réglages."); return false; }
  if (!cv) { alert("Chargez votre CV (PDF) dans les réglages."); return false; }
  return true;
}

async function generate(item) {
  if (!ready() || item.controller) return;
  item.controller = new AbortController();
  const btn = $(".gen", item.el);
  btn.disabled = true;
  setStatus(item, "Démarrage…", "busy");
  let searches = 0;
  let writing = false;
  try {
    const content = await callOpenAI(item, (type) => {
      if (type === "search") setStatus(item, `Recherche web (${++searches})…`, "busy");
      else if (type === "text") { if (!writing) { writing = true; setStatus(item, "Rédaction…", "busy"); } }
      else if (type === "thinking") setStatus(item, "Réflexion…", "busy");
    });
    const parsed = parseOutput(content);
    const signature = $("#signature").value.trim();
    const r = {
      ...parsed,
      body: signature ? `${parsed.body}\n\n${signature}` : parsed.body,
      to: $(".to", item.el).value.trim(),
    };
    results[keyOf(item.row)] = r;
    store.set("results", results);
    showResult(item, r);
  } catch (err) {
    console.error(err);
    setStatus(item, errorMessage(await diagnose(err)), "err");
  } finally {
    item.controller = null;
    btn.disabled = false;
  }
}

// ---------- Tout générer ----------
let running = false;
$("#generateAll").addEventListener("click", async () => {
  if (!ready() || running) return;
  running = true;
  $("#generateAll").disabled = true;
  $("#stopAll").disabled = false;
  const queue = items.filter((i) => !results[keyOf(i.row)]);
  const worker = async () => {
    while (running && queue.length) await generate(queue.shift());
  };
  await Promise.all([worker(), worker()]); // 2 entreprises en parallèle
  running = false;
  $("#generateAll").disabled = false;
  $("#stopAll").disabled = true;
});
$("#stopAll").addEventListener("click", () => {
  running = false;
  items.forEach((i) => i.controller?.abort());
});

// ---------- Export ----------
$("#exportCsv").addEventListener("click", () => {
  const out = items.map(({ row, el }) => {
    const r = results[keyOf(row)] || {};
    return {
      ...row,
      "Objet": $(".subject", el).value || r.subject || "",
      "Message": $(".body", el).value || r.body || "",
      "Recherche": r.summary || "",
      "Lien Gmail": r.subject ? $(".gmail", el).href : "",
    };
  });
  const csv = "﻿" + Papa.unparse(out, { delimiter: ";" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "candidatures.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});
