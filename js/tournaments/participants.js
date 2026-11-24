const PLAYER_LEVELS = ["Débutant", "Intermédiaire", "Confirmé"];
const HELLOASSO_ENDPOINT = ""; // URL de ton petit serveur renvoyant [{prenom,nom,niveau}]
const rank = (l) => {
  const i = PLAYER_LEVELS.findIndex(
    (x) => norm(x).slice(0, 3) === norm(l).slice(0, 3),
  );
  return i < 0 ? 0 : i;
};
function parseCsv(t) {
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const d =
    (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length
      ? ";"
      : ",";
  const cut = (l) => l.split(d).map((c) => c.replace(/^"|"$/g, "").trim());
  const h = cut(lines[0]).map(norm);
  let ip = h.findIndex((c) => c.includes("prenom")),
    inn = h.findIndex((c) => c.includes("nom") && !c.includes("prenom")),
    il = h.findIndex((c) => c.includes("niveau"));
  let rows = lines;
  if (ip < 0 || inn < 0) {
    ip = 0;
    inn = 1;
    il = il < 0 ? 2 : il;
  } else rows = lines.slice(1);
  return rows
    .map(cut)
    .filter((r) => r[ip] || r[inn])
    .map((r) => ({
      p: r[ip] || "",
      n: r[inn] || "",
      l: PLAYER_LEVELS[rank(r[il])],
    }));
}
function addMany(a) {
  a.forEach((x) => {
    if (
      !tournamentState.players.some((p) => norm(p.p + p.n) === norm(x.p + x.n))
    )
      tournamentState.players.push({ id: uid(), ...x });
  });
  saveTournament();
  renderParticipants();
}
function importCsv() {
  addMany(parseCsv($("csv").value));
  $("csv").value = "";
}
function loadFile(i) {
  const f = i.files[0];
  if (f) f.text().then((t) => addMany(parseCsv(t)));
}
async function sync() {
  if (!HELLOASSO_ENDPOINT)
    return alert(
      "HelloAsso n’autorise pas la lecture directe depuis une page web (clé API secrète). Utilise l’import CSV, ou renseigne HELLOASSO_ENDPOINT avec l’adresse de ton propre serveur.",
    );
  try {
    const r = await (await fetch(HELLOASSO_ENDPOINT)).json();
    addMany(
      r.map((x) => ({
        p: x.prenom,
        n: x.nom,
        l: PLAYER_LEVELS[rank(x.niveau)],
      })),
    );
  } catch (e) {
    alert("Synchronisation impossible.");
  }
}

/* ---------- participants ---------- */
function opts(sel) {
  return PLAYER_LEVELS.map(
    (l) => `<option${l === sel ? " selected" : ""}>${l}</option>`,
  ).join("");
}
function renderParticipants() {
  $("nl").innerHTML = opts();
  const ps = tournamentState.players;
  $("plist").innerHTML = ps.length
    ? `<table><tr><th>Prénom</th><th>Nom</th><th>Niveau</th><th></th></tr>${ps
        .map(
          (p) => `<tr>
 <td><input value="${esc(p.p)}" data-player-field="p" data-player-id="${esc(p.id)}" aria-label="Prénom"></td>
 <td><input value="${esc(p.n)}" data-player-field="n" data-player-id="${esc(p.id)}" aria-label="Nom"></td>
 <td><select data-player-field="l" data-player-id="${esc(p.id)}" aria-label="Niveau">${opts(p.l)}</select></td>
 <td><button class="b ghost" data-remove-player="${esc(p.id)}">Supprimer</button></td></tr>`,
        )
        .join("")}</table><p class="hint">${ps.length} participant(s)</p>`
    : '<div class="empty">Aucun participant. Importe le CSV HelloAsso ou ajoute-les à la main.</div>';
  $("mode").value = tournamentState.mode;
  $("fmt").value = tournamentState.format || "se";
  $("psz").value = tournamentState.size || 4;
  $("pq").value = tournamentState.q || 2;
  updateFormatOptions();
  renderBrackets();
}
function editParticipant(id, k, v) {
  const p = findPlayer(id);
  if (!p) return;
  p[k] = v.trim() || p[k];
  saveTournament();
  renderBrackets();
}
function addParticipant() {
  const p = $("np").value.trim(),
    n = $("nn").value.trim();
  if (!p || !n) return alert("Prénom et nom requis.");
  const x = { id: uid(), p, n, l: $("nl").value };
  tournamentState.players.push(x);
  if (tournamentState.brackets) {
    const b = tournamentState.brackets.find(
      (b) => b.level === (tournamentState.mode === "level" ? x.l : "all"),
    );
    let ok = false;
    if (b && b.type !== "po")
      for (const m of b.secs[0].rounds[0]) {
        if (m.a === "-" && m.b !== "-") {
          m.a = x.id;
          m.w = null;
          ok = true;
          break;
        }
        if (m.b === "-" && m.a !== "-") {
          m.b = x.id;
          m.w = null;
          ok = true;
          break;
        }
      }
    if (ok) prop(b);
    else
      alert(
        "Impossible d’ajouter ce joueur au tableau en cours (aucune place libre, ou phase de poules déjà tirée). Régénère le tableau pour l’inclure.",
      );
  }
  $("np").value = $("nn").value = "";
  saveTournament();
  renderParticipants();
}
function removeParticipant(id) {
  if (!confirm("Supprimer ce participant ?")) return;
  tournamentState.players = tournamentState.players.filter((p) => p.id !== id);
  (tournamentState.brackets || []).forEach((b) => {
    if (b.type === "po")
      b.groups.forEach((g) => {
        g.ps = g.ps.filter((x) => x !== id);
        g.ms = g.ms.filter((m) => m.a !== id && m.b !== id);
      });
    else
      b.secs[0].rounds[0].forEach((m) => {
        if (m.a === id) m.a = "-";
        if (m.b === id) m.b = "-";
      });
    prop(b);
  });
  saveTournament();
  renderParticipants();
}

$("plist").addEventListener("change", (event) => {
  const field = event.target.closest("[data-player-field]");
  if (field)
    editParticipant(
      field.dataset.playerId,
      field.dataset.playerField,
      field.value,
    );
});
$("plist").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-player]");
  if (button) removeParticipant(button.dataset.removePlayer);
});
