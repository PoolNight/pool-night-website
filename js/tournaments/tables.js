const TBS = () => tournamentState.tables || (tournamentState.tables = []);
const tbName = (id) => {
  const t = (tournamentState.tables || []).find((t) => t.id === id);
  return t ? t.name : "";
};
function allMatches() {
  const a = [];
  (tournamentState.brackets || []).forEach((b) => {
    (b.groups || []).forEach((g) => g.ms.forEach((m) => a.push({ m, r: 0 })));
    b.secs.forEach((s) =>
      s.rounds.forEach((R, r) => R.forEach((m) => a.push({ m, r: 1 + r }))),
    );
  });
  return a.sort((x, y) => x.r - y.r);
}
const playable = (m) => m.w === null && findPlayer(m.a) && findPlayer(m.b);
/* chrono des parties : démarre quand une table est attribuée au match, s'arrête au résultat ; le temps est cumulé par table (t.acc) */
const fmtD = (ms) => {
  ms = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(ms / 3600),
    m = Math.floor((ms % 3600) / 60),
    s = ms % 60,
    z = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${z(m)}:${z(s)}` : `${z(m)}:${z(s)}`;
};
function tbOff(m) {
  if (m.ts && m.tb) {
    const t = TBS().find((t) => t.id === m.tb);
    if (t) t.acc = (t.acc || 0) + Math.max(0, Date.now() - m.ts);
  }
  delete m.ts;
}
function setMatchDuration(v) {
  tournamentState.tmin = Math.max(0, Math.min(240, parseInt(v, 10) || 0));
  saveTournament();
  renderBrackets();
}
const tmHtml = (m) =>
  m.tb && m.ts && m.w === null
    ? `<span class="tm" data-ts="${esc(m.ts)}" data-lim="${esc(tournamentState.tmin || 0)}" title="Temps de la partie${tournamentState.tmin ? " (durée prévue " + esc(tournamentState.tmin) + " min)" : ""}">⏱ ${fmtD(Date.now() - m.ts)}${tournamentState.tmin ? " / " + esc(tournamentState.tmin) + " min" : ""}</span>`
    : "";
function updateMatchTimers() {
  const now = Date.now();
  document.querySelectorAll(".tm[data-ts]").forEach((e) => {
    const d = now - +e.dataset.ts,
      l = (+e.dataset.lim || 0) * 60000;
    e.textContent = "⏱ " + fmtD(d) + (l ? " / " + l / 60000 + " min" : "");
    e.classList.toggle("over", !!l && d > l);
  });
  document.querySelectorAll(".tt").forEach((e) => {
    const c = +e.dataset.ts ? now - +e.dataset.ts : 0;
    e.textContent = fmtD((+e.dataset.acc || 0) + c);
  });
}
/* attribue chaque table prête et libre au prochain match jouable (tours les plus anciens d'abord) */
function autoAssign() {
  const ts = tournamentState.tables || [];
  if (!ts.length || !tournamentState.brackets) return false;
  const L = allMatches(),
    ids = new Set(ts.map((t) => t.id)),
    used = new Set(),
    busy = new Set();
  L.forEach(({ m }) => {
    if (m.tb && m.w === null) {
      if (ids.has(m.tb)) {
        used.add(m.tb);
        busy.add(m.a);
        busy.add(m.b);
        if (m.live && !m.ts) m.ts = Date.now();
      } else {
        delete m.tb;
        delete m.ts;
      }
    }
  });
  let ch = false;
  for (const t of ts) {
    if (!t.ready || used.has(t.id)) continue;
    const c = L.find(
      ({ m }) => playable(m) && !m.tb && !busy.has(m.a) && !busy.has(m.b),
    );
    if (c) {
      c.m.tb = t.id;
      if (c.m.live) c.m.ts = Date.now();
      used.add(t.id);
      busy.add(c.m.a);
      busy.add(c.m.b);
      ch = true;
    }
  }
  return ch;
}
function setTableCount(v) {
  const n = Math.max(0, Math.min(30, parseInt(v, 10) || 0)),
    ts = TBS();
  while (ts.length < n)
    ts.push({
      id: "t" + uid(),
      name: "Table " + (ts.length + 1),
      ready: false,
    });
  if (ts.length > n) {
    const gone = new Set(ts.splice(n).map((t) => t.id));
    allMatches().forEach(({ m }) => {
      if (gone.has(m.tb)) {
        delete m.tb;
        delete m.ts;
      }
    });
  }
  autoAssign();
  saveTournament();
  renderBrackets();
}
function tbSet(id, k, v) {
  const t = TBS().find((t) => t.id === id);
  if (!t) return;
  if (k === "name") t.name = v.trim() || t.name;
  else t[k] = v;
  if (k === "ready") autoAssign();
  saveTournament();
  renderBrackets();
}
function pickTable(k, v) {
  const r = renderedMatches[k];
  if (!r) return;
  if (
    v &&
    allMatches().some((x) => x.m !== r.m && x.m.tb === v && x.m.w === null)
  ) {
    alert("Cette table est déjà utilisée par un autre match.");
    renderBrackets();
    return;
  }
  if (r.m.tb) tbOff(r.m);
  if (v) {
    r.m.tb = v;
    if (r.m.live) r.m.ts = Date.now();
  } else delete r.m.tb;
  saveTournament();
  renderBrackets();
}
function toggleLive(k) {
  const r = renderedMatches[k];
  if (!r) return;
  if (r.m.live) {
    tbOff(r.m);
    delete r.m.live;
  } else {
    r.m.live = true;
    if (r.m.tb) r.m.ts = Date.now();
  }
  saveTournament();
  renderBrackets();
}
function renderTables() {
  const ts = tournamentState.tables || [],
    busy = {},
    cur = {};
  allMatches().forEach(({ m }) => {
    if (m.tb && m.w === null) {
      cur[m.tb] = m.ts || 0;
      const a = findPlayer(m.a),
        b = findPlayer(m.b);
      busy[m.tb] = a && b ? `${a.p} ${a.n} vs ${b.p} ${b.n}` : "occupée";
    }
  });
  const n = $("ntb");
  if (n && document.activeElement !== n) n.value = ts.length || "";
  const tm = $("tmin");
  if (tm && document.activeElement !== tm)
    tm.value = tournamentState.tmin || "";
  $("tbl").innerHTML = ts.length
    ? ts
        .map(
          (t) =>
            `<div class="tbr ${busy[t.id] ? "busy" : t.ready ? "free" : ""}"><input type="text" value="${esc(t.name)}" data-table-field="name" data-table-id="${esc(t.id)}" aria-label="Nom de la table"><label><input type="checkbox"${t.ready ? " checked" : ""} data-table-field="ready" data-table-id="${esc(t.id)}"> Prête</label><span class="st">${busy[t.id] ? esc(busy[t.id]) : t.ready ? "libre" : "non prête"}</span><span class="ttw" title="Temps de jeu cumulé sur cette table">Total : <b class="tt" data-acc="${esc(t.acc || 0)}" data-ts="${esc(cur[t.id] || 0)}">${fmtD((t.acc || 0) + (cur[t.id] ? Date.now() - cur[t.id] : 0))}</b></span></div>`,
        )
        .join("")
    : '<div class="empty">Aucune table. Saisis un nombre de tables dans la section « Tournoi » (facultatif).</div>';
}

$("tbl").addEventListener("change", (event) => {
  const field = event.target.closest("[data-table-field]");
  if (!field) return;
  const { tableId, tableField } = field.dataset;
  tbSet(
    tableId,
    tableField,
    tableField === "ready" ? field.checked : field.value,
  );
});
