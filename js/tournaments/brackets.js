const BALL =
  '<svg class="ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#111" stroke="#fff" stroke-width="1"/><circle cx="12" cy="11.5" r="5.4" fill="#fff"/><text x="12" y="14.6" text-anchor="middle" font-family="Anton,Arial,sans-serif" font-weight="700" font-size="8.5" fill="#111">8</text><ellipse cx="8" cy="6.5" rx="2.6" ry="1.4" fill="#fff" opacity=".45" transform="rotate(-35 8 6.5)"/></svg>';
function lastNode(b, me) {
  let n = null;
  b.secs.forEach((s) =>
    s.rounds.forEach((R, r) => {
      if (r > 0)
        R.forEach((m) => {
          if (m.a === me || m.b === me) n = m;
        });
    }),
  );
  return n;
}

/* ---------- tableau ---------- */
const FMT = {
  se: "Élimination directe",
  de: "Double élimination",
  po: "Poules et phase finale",
};
const renderedMatches = [];
const mk = (a, b) => ({ a: a, b: b, w: null });
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sortSeed = (ps) => shuffle(ps).sort((a, b) => rank(b.l) - rank(a.l));
function seedOrder(n) {
  let o = [1];
  while (o.length < n) {
    const m = o.length * 2 + 1;
    o = o.flatMap((x) => [x, m - x]);
  }
  return o;
}
function seeded(list) {
  let N = 2;
  while (N < list.length) N *= 2;
  return seedOrder(N).map((k) => (k <= list.length ? list[k - 1] : "-"));
}
const rname = (r, t) =>
  t - r === 1
    ? "Finale"
    : t - r === 2
      ? "Demi-finales"
      : t - r === 3
        ? "Quarts de finale"
        : t - r === 4
          ? "8es de finale"
          : "Tour " + (r + 1);
/* '-' = place vide définitive (exempt), null = en attente */
function fix(m) {
  const a = m.a,
    b = m.b;
  if (a === "-" && b === "-") m.w = "-";
  else if (a === "-") m.w = b;
  else if (b === "-") m.w = a;
  else if (a === null || b === null) m.w = null;
  else if (m.w !== null && m.w !== a && m.w !== b) m.w = null;
}
function set(m, a, b) {
  if (m.a !== a || m.b !== b) m.w = null;
  m.a = a;
  m.b = b;
  fix(m);
}
const lose = (m) =>
  m.w === null || m.a === null || m.b === null
    ? null
    : m.a === "-" || m.b === "-"
      ? "-"
      : m.w === m.a
        ? m.b
        : m.a;
function ko(slots, isRef) {
  const t = Math.log2(slots.length),
    rounds = [];
  let n = slots.length / 2;
  while (n >= 1) {
    rounds.push(Array.from({ length: n }, () => mk(null, null)));
    n /= 2;
  }
  if (!isRef)
    rounds[0].forEach((m, i) => {
      m.a = slots[2 * i];
      m.b = slots[2 * i + 1];
    });
  return {
    t: "",
    rounds,
    titles: rounds.map((_, r) => rname(r, t)),
    refs: isRef ? slots : null,
  };
}
function stand(g) {
  const W = {};
  g.ps.forEach((id) => (W[id] = 0));
  g.ms.forEach((m) => {
    if (m.w) W[m.w]++;
  });
  const h = (a, b) => {
    const m = g.ms.find(
      (m) => (m.a === a && m.b === b) || (m.a === b && m.b === a),
    );
    return m && m.w === a ? -1 : m && m.w === b ? 1 : 0;
  };
  const ids = [...g.ps].sort(
    (a, b) => W[b] - W[a] || h(a, b) || g.ps.indexOf(a) - g.ps.indexOf(b),
  );
  return {
    rows: ids.map((id) => ({
      id,
      v: W[id],
      d: g.ms.filter((m) => m.w && (m.a === id || m.b === id) && m.w !== id)
        .length,
    })),
    done: g.ms.every((m) => m.w),
  };
}
function res(b, ref) {
  if (ref === "-") return "-";
  const s = stand(b.groups[ref.g]);
  return s.done ? (s.rows[ref.pos] ? s.rows[ref.pos].id : "-") : null;
}
function koProp(s, b) {
  const R = s.rounds;
  R[0].forEach((m, i) =>
    s.refs
      ? set(m, res(b, s.refs[2 * i]), res(b, s.refs[2 * i + 1]))
      : set(m, m.a, m.b),
  );
  for (let r = 1; r < R.length; r++)
    R[r].forEach((m, i) => set(m, R[r - 1][2 * i].w, R[r - 1][2 * i + 1].w));
}
function deProp(b) {
  const [W, L, F] = b.secs,
    Wr = W.rounds,
    lr = L.rounds;
  koProp(W, b);
  lr.forEach((R, j) => {
    const d = L.desc[j];
    R.forEach((m, i) => {
      if (j === 0) set(m, lose(Wr[0][2 * i]), lose(Wr[0][2 * i + 1]));
      else if (d.t === "pair")
        set(m, lr[j - 1][2 * i].w, lr[j - 1][2 * i + 1].w);
      else set(m, lr[j - 1][i].w, lose(Wr[d.r][Wr[d.r].length - 1 - i]));
    });
  });
  const gf = F.rounds[0][0],
    rs = F.rounds[1][0];
  set(gf, Wr[Wr.length - 1][0].w, lr[lr.length - 1][0].w);
  const lb = gf.w !== null && gf.w === gf.b;
  set(rs, lb ? gf.a : null, lb ? gf.b : null);
}
const prop = (b) => (b.type === "de" ? deProp(b) : koProp(b.secs[0], b));
function chmp(b) {
  if (b.type === "de") {
    const [gf, rs] = b.secs[2].rounds.map((r) => r[0]);
    return gf.w === null ? null : gf.w === gf.a ? gf.w : rs.w;
  }
  const R = b.secs[0].rounds;
  return R[R.length - 1][0].w;
}
function buildSE(ps, name, level) {
  const b = {
    type: "se",
    name,
    level,
    secs: [ko(seeded(sortSeed(ps).map((p) => p.id)))],
  };
  prop(b);
  return b;
}
function buildDE(ps, name, level) {
  if (ps.length < 3) return buildSE(ps, name, level);
  const W = ko(seeded(sortSeed(ps).map((p) => p.id))),
    Wr = W.rounds,
    k = Wr.length;
  const desc = [{ t: "pair", r: 0 }];
  for (let r = 1; r < k; r++) {
    desc.push({ t: "drop", r });
    if (r < k - 1) desc.push({ t: "pair", r });
  }
  let c = Wr[0].length / 2;
  const lr = desc.map((d, j) => {
    if (j > 0) c = d.t === "drop" ? Wr[d.r].length : c / 2;
    return Array.from({ length: c }, () => mk(null, null));
  });
  W.t = "Tableau des gagnants";
  W.titles[k - 1] = "Finale des gagnants";
  const L = {
    t: "Tableau des repêchages",
    rounds: lr,
    desc,
    titles: desc.map((_, j) =>
      j === desc.length - 1 ? "Finale des repêchages" : "Repêchage " + (j + 1),
    ),
    refs: null,
  };
  const F = {
    t: "Finale",
    rounds: [[mk(null, null)], [mk(null, null)]],
    titles: ["Grande finale", "Finale de reset (si besoin)"],
    refs: null,
  };
  const b = { type: "de", name, level, secs: [W, L, F] };
  prop(b);
  return b;
}
function buildPO(ps, name, level, size, q) {
  if (ps.length < 3) return buildSE(ps, name, level);
  const s = sortSeed(ps),
    G = Math.max(1, Math.ceil(s.length / size));
  const groups = Array.from({ length: G }, () => ({ ps: [], ms: [] }));
  s.forEach((p, i) => {
    const row = Math.floor(i / G);
    groups[row % 2 ? G - 1 - (i % G) : i % G].ps.push(p.id);
  });
  groups.forEach((g) => {
    for (let i = 0; i < g.ps.length; i++)
      for (let j = i + 1; j < g.ps.length; j++) g.ms.push(mk(g.ps[i], g.ps[j]));
  });
  let qq = Math.max(
    1,
    Math.min(q, Math.min(...groups.map((g) => g.ps.length)) - 1),
  );
  if (G * qq < 2) qq = 2;
  const refs = [];
  for (let pos = 0; pos < qq; pos++)
    for (let g = 0; g < G; g++) refs.push({ g, pos });
  const K = ko(seeded(refs), true);
  K.t = "Phase finale";
  const b = { type: "po", name, level, q: qq, groups, secs: [K] };
  prop(b);
  return b;
}
function generateBrackets() {
  if (tournamentState.players.length < 2)
    return alert("Il faut au moins 2 participants.");
  if (
    tournamentState.brackets &&
    !confirm("Régénérer efface tous les résultats. Continuer ?")
  )
    return;
  const f = tournamentState.format || "se",
    bld = (ps, n, l) =>
      f === "de"
        ? buildDE(ps, n, l)
        : f === "po"
          ? buildPO(ps, n, l, tournamentState.size || 4, tournamentState.q || 2)
          : buildSE(ps, n, l);
  if (tournamentState.mode === "level") {
    tournamentState.brackets = PLAYER_LEVELS.map((l) => ({
      l,
      ps: tournamentState.players.filter((p) => p.l === l),
    }))
      .filter((g) => g.ps.length > 1)
      .map((g) => bld(g.ps, g.l, g.l));
    const alone = PLAYER_LEVELS.filter(
      (l) => tournamentState.players.filter((p) => p.l === l).length === 1,
    );
    if (alone.length)
      alert(
        "Un seul inscrit au niveau : " +
          alone.join(", ") +
          ". Pas de tableau pour eux ; passe en tableau unique ou change leur niveau.",
      );
  } else
    tournamentState.brackets = [
      bld(tournamentState.players, "Tableau principal", "all"),
    ];
  autoAssign();
  saveTournament();
  renderBrackets();
}
function pick(k, id) {
  const r = renderedMatches[k];
  if (!r || !findPlayer(r.m.a) || !findPlayer(r.m.b)) return;
  const had = r.m.w;
  r.m.w = had === id ? null : id;
  /* horodatage de la saisie : sert à rejouer les matchs dans l'ordre pour le classement ELO */
  if (r.m.w === null) delete r.m.t;
  else if (had === null || typeof r.m.t !== "number") r.m.t = Date.now();
  if (r.m.w !== null) {
    tbOff(r.m);
    delete r.m.tb;
    delete r.m.live;
  }
  prop(r.b);
  autoAssign();
  saveTournament();
  renderBrackets();
}
function mHtml(m, b, me, edit) {
  const k = renderedMatches.push({ m, b }) - 1,
    ok = findPlayer(m.a) && findPlayer(m.b),
    path = me && (m.a === me || m.b === me),
    now = path && m.w === null && ok;
  const row = (id) => {
    const p = findPlayer(id);
    if (!p)
      return `<div class="pl bye">${id === "-" ? "exempt" : "à déterminer"}</div>`;
    const c = [
      "pl",
      m.w === id ? "win" : "",
      m.w && m.w !== id ? "lose" : "",
      id === me ? "me" : "",
    ].join(" ");
    return `<div class="${c}"${edit && ok ? ` data-match-index="${k}" data-winner="${esc(id)}"` : ""}>${esc(p.p)} ${esc(p.n)}<small>${esc(p.l.slice(0, 3))}</small></div>`;
  };
  const ts = tournamentState.tables || [],
    open = ok && m.w === null;
  let foot = "";
  if (open && edit && ts.length)
    foot = `<div class="mt"><button class="${m.live ? "on" : ""}" data-live-match="${k}" aria-pressed="${!!m.live}">${m.live ? "● En cours" : "Mettre en cours"}</button><select data-table-match="${k}" aria-label="Table du match"><option value="">Table…</option>${ts.map((t) => `<option value="${esc(t.id)}"${m.tb === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>${tmHtml(m)}</div>`;
  else if (open && edit)
    foot = `<div class="mt"><button class="${m.live ? "on" : ""}" data-live-match="${k}" aria-pressed="${!!m.live}">${m.live ? "● En cours" : "Mettre en cours"}</button></div>`;
  else if (open && (m.live || m.tb))
    foot = `<div class="mb"><em>${m.live ? "En cours" : ""}</em><span>${m.tb && tbName(m.tb) ? esc(tbName(m.tb)) : ""} ${tmHtml(m)}</span></div>`;
  return `<div class="match${path ? " path" : ""}${now ? " now" : ""}${open && m.live ? " live" : ""}">${row(m.a)}${row(m.b)}${foot}</div>`;
}
function cols(s, b, me, edit, node) {
  return `<div class="scroll"><div class="bracket">${s.rounds
    .map((R, r) => {
      const nx = s.rounds[r + 1],
        pair = nx && nx.length * 2 === R.length,
        st = nx && nx.length === R.length,
        pv = r > 0 && s.rounds[r - 1].length === R.length * 2;
      return `<div class="round"><h4>${esc(s.titles[r])}</h4><div class="ms">${R.map((m, i) => `<div class="slot">${pv ? '<i class="d"></i>' : ""}${mHtml(m, b, me, edit)}${node && node === m ? BALL : ""}${pair ? `<i class="c ${i % 2 ? "up" : "dn"}"></i>` : st ? '<i class="c st"></i>' : ""}</div>`).join("")}</div></div>`;
    })
    .join("")}</div></div>`;
}
function bHtml(b, me, edit) {
  const node = me && !edit ? lastNode(b, me) : null;
  let h = `<div class="bname"><span>${esc(b.name)}</span><span class="zc" role="group" aria-label="Zoom du tableau"><button type="button" onclick="zoomBy(-1)" aria-label="Dézoomer">−</button><span class="zp">${Math.round(Z * 100)}%</span><button type="button" onclick="zoomBy(1)" aria-label="Zoomer">+</button><button type="button" class="zf" onclick="zoomFit()" title="Tout voir à l’écran">Ajuster</button></span></div>`;
  if (b.type === "po")
    h += `<div class="sname">Phase de poules</div><div class="groups">${b.groups
      .map((g, gi) => {
        const st = stand(g);
        return `<div class="grp"><h3>Poule ${String.fromCharCode(65 + gi)}</h3><table>${st.rows
          .map((r, i) => {
            const p = findPlayer(r.id);
            return `<tr class="${i < b.q && st.done ? "q" : ""}${r.id === me ? " mine" : ""}"><td>${i + 1}</td><td>${p ? esc(p.p + " " + p.n) : ""}</td><td>${r.v} V</td><td>${r.d} D</td></tr>`;
          })
          .join(
            "",
          )}</table><div class="gm">${g.ms.map((m) => mHtml(m, b, me, edit)).join("")}</div></div>`;
      })
      .join("")}</div>`;
  return (
    h +
    b.secs
      .map(
        (s) =>
          (s.t ? `<div class="sname">${esc(s.t)}</div>` : "") +
          cols(s, b, me, edit, node),
      )
      .join("")
  );
}
function renderBrackets() {
  renderedMatches.length = 0;
  renderTables();
  $("bO").innerHTML =
    tournamentState.brackets && tournamentState.brackets.length
      ? tournamentState.brackets.map((b) => bHtml(b, null, true)).join("")
      : '<div class="empty">Pas encore de tableau. Ajoute des participants puis clique sur « Générer le tableau ».</div>';
}
function updateFormatOptions() {
  $("poOpts").classList.toggle(
    "hide",
    (tournamentState.format || "se") !== "po",
  );
}

$("bO").addEventListener("click", (event) => {
  const player = event.target.closest("[data-winner]");
  if (player) pick(Number(player.dataset.matchIndex), player.dataset.winner);
  const live = event.target.closest("[data-live-match]");
  if (live) toggleLive(Number(live.dataset.liveMatch));
});
$("bO").addEventListener("change", (event) => {
  const table = event.target.closest("[data-table-match]");
  if (table) pickTable(Number(table.dataset.tableMatch), table.value);
});
