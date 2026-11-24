const ELO_START = 1000,
  ELO_K = 32,
  BONUS_WIN = 5,
  BONUS_TITLE = 25; /* paramètres du classement ELO (voir Systeme_ELO_Billard_Global.xlsx) */
const real = (i) => i && i !== "-";
const pkey = (n) => norm(n).split(/\s+/).sort().join(" ");
function podium(b) {
  if (b.type === "de") {
    const [gf, rs] = b.secs[2].rounds.map((r) => r[0]);
    if (!real(gf.w)) return [null, null];
    const m = gf.w === gf.a ? gf : rs;
    return real(m.w) ? [m.w, m.w === m.a ? m.b : m.a] : [null, null];
  }
  const R = b.secs[0].rounds,
    f = R[R.length - 1][0];
  return real(f.w) ? [f.w, f.w === f.a ? f.b : f.a] : [null, null];
}
/* Liste ordonnée des matchs réellement joués d'un tournoi (les byes ne comptent pas).
   Ordre : horodatage de saisie (m.t) s'il existe partout, sinon ordre logique des tours. */
function extractTournoi(t) {
  if (
    !t ||
    !Array.isArray(t.players) ||
    !Array.isArray(t.brackets) ||
    !t.brackets.length ||
    t.brackets.some((b) => !b.secs)
  )
    throw new Error(
      "Format non reconnu : exporte tournoi.json depuis la dernière version de la page tournois, avec un tableau généré.",
    );
  const P = {},
    L = [],
    champs = [];
  let open = 0,
    seq = 0;
  t.players.forEach((p) => (P[p.id] = p));
  const nm = (id) => `${P[id].p} ${P[id].n}`.trim();
  t.brackets.forEach((b, bi) => {
    const add = (m, key) => {
      if (
        real(m.a) &&
        real(m.b) &&
        real(m.w) &&
        P[m.a] &&
        P[m.b] &&
        m.a !== m.b
      )
        L.push({
          a: nm(m.a),
          b: nm(m.b),
          w: m.w === m.a ? 0 : 1,
          t: m.t,
          key,
          bi,
          seq: seq++,
        });
    };
    (b.groups || []).forEach((g) => g.ms.forEach((m) => add(m, 0)));
    b.secs.forEach((s, si) =>
      s.rounds.forEach((R, r) =>
        R.forEach((m) =>
          add(
            m,
            b.type === "po"
              ? 1 + r
              : b.type === "de"
                ? si === 0
                  ? 2 * r
                  : si === 1
                    ? r + 1.5
                    : 1000 + r
                : r,
          ),
        ),
      ),
    );
    const ch = podium(b)[0];
    if (ch && P[ch]) champs.push(nm(ch));
    else open++;
  });
  const ts = L.length > 0 && L.every((x) => typeof x.t === "number");
  L.sort(
    ts
      ? (x, y) => x.t - y.t || x.seq - y.seq
      : (x, y) => x.key - y.key || x.bi - y.bi || x.seq - y.seq,
  );
  return { matches: L.map((x) => ({ a: x.a, b: x.b, w: x.w })), open, champs };
}
/* ELO : EA = 1/(1+10^((ELO_B-ELO_A)/400)) ; delta = K*(score-EA) ; B reçoit -delta. Tout est rejoué du premier au dernier match. */
function board(src = "all", sp = selectedSport) {
  const P = {};
  /* Orthographes différentes d'un même joueur : « variante » → nom affiché. Ajoute une ligne par joueur concerné. */
  const ALIAS = { "Virgile HOQUET-GALLET": "Virgile Hocquet-Gallet" },
    AL = {};
  Object.keys(ALIAS).forEach((k) => (AL[pkey(k)] = ALIAS[k]));
  const get = (nm) => {
    nm = AL[pkey(nm)] || nm;
    return (
      P[pkey(nm)] ||
      (P[pkey(nm)] = { name: nm, elo: ELO_START, m: 0, v: 0, d: 0 })
    );
  };
  const play = (m) => {
      const A = get(m.a),
        B = get(m.b);
      if (A === B) return;
      const sa = m.w === 0 ? 1 : 0,
        ea = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400)),
        d = ELO_K * (sa - ea);
      A.elo += d;
      B.elo -= d;
      (sa ? A : B).elo += BONUS_WIN;
      A.m++;
      B.m++;
      if (sa) {
        A.v++;
        B.d++;
      } else {
        B.v++;
        A.d++;
      }
    },
    ev = [];
  if (sp === "billard" && src !== "defis")
    siteData.results.forEach((t) => {
      if (Array.isArray(t.matches))
        ev.push({
          ts: new Date((t.date || "") + "T12:00:00").getTime() || 0,
          t,
        });
    });
  if (src !== "tournois")
    challenges
      .filter((d) => d.status === "confirmed" && (d.sp || "billard") === sp)
      .forEach((d) => ev.push({ ts: d.tc || d.t || 0, d }));
  ev.sort(
    (x, y) => x.ts - y.ts,
  ); /* tri stable : à date égale, l'ordre d'enregistrement est conservé */
  ev.forEach((e) => {
    if (e.t) {
      e.t.matches.forEach(play);
      (e.t.champs || []).forEach((n) => {
        get(n).elo += BONUS_TITLE;
      });
    } else play({ a: e.d.a, b: e.d.b, w: e.d.w });
  });
  return Object.values(P).sort(
    (a, b) => b.elo - a.elo || b.v - a.v || a.name.localeCompare(b.name),
  );
}
const BALLC = [
  "#f2c200",
  "#1f4fa8",
  "#d3291f",
  "#5b2a86",
  "#ee7a14",
  "#1f7a3a",
  "#7a1f1f",
  "#141414",
];
const ball = (n) =>
  `<span class="bl${n > 8 ? " s" : ""}" style="--c:${BALLC[(n - 1) % 8]}" role="img" aria-label="Rang ${n}"><b>${n}</b></span>`;
let leaderboardSource = "all",
  selectedSport = "billard";
const SPN = { billard: "Billard", flechettes: "Fléchettes" };
function lbSet(m) {
  leaderboardSource = m;
  renderBoard();
}
function spSet(v) {
  const o = selectedSport;
  selectedSport = v === "flechettes" ? "flechettes" : "billard";
  if (selectedSport === "flechettes") leaderboardSource = "defis";
  else if (o === "flechettes") leaderboardSource = "all";
  renderBoard();
  renderDefiLog();
  if ($("dsp")) $("dsp").value = selectedSport;
}
function dSport(v) {
  spSet(v);
}
function renderBoard() {
  const fl = selectedSport === "flechettes";
  if (fl) leaderboardSource = "defis";
  const sel = $("lbsp");
  if (sel) sel.value = selectedSport;
  const tb = $("lbtabs");
  if (tb) tb.hidden = fl;
  const rows = board(leaderboardSource);
  ["all", "tournois", "defis"].forEach((k) => {
    const b = $("lbt-" + k);
    if (b) b.setAttribute("aria-pressed", k === leaderboardSource);
  });
  const empty = fl
    ? {
        defis:
          "Aucun défi de fléchettes confirmé pour l’instant. Lance le premier avec « Défie un ami ».",
      }
    : {
        all: "Le classement apparaîtra après le premier tournoi importé.",
        tournois: "Aucun tournoi importé pour l’instant.",
        defis: "Aucun défi confirmé pour l’instant.",
      }[leaderboardSource];
  $("lb").innerHTML = rows.length
    ? `<table class="lb"><tr><th>#</th><th>Joueur</th><th class="pts">ELO</th><th>Matchs</th><th>Victoires</th><th>Défaites</th><th>Win rate</th><th>Variation</th></tr>${rows
        .map((x) => {
          const rk = 1 + rows.filter((y) => y.elo > x.elo).length,
            dv = Math.round(x.elo - ELO_START);
          return `<tr class="${rk < 4 ? "top" + rk : ""}"><td>${rk <= 15 ? ball(rk) : rk}</td><td>${esc(x.name)}</td><td class="pts">${Math.round(x.elo)}</td><td>${x.m}</td><td>${x.v}</td><td>${x.d}</td><td>${Math.round((100 * x.v) / x.m)} %</td><td>${dv > 0 ? "+" : ""}${dv}</td></tr>`;
        })
        .join("")}</table>`
    : `<div class="empty">${empty}</div>`;
  const base = `Chaque joueur démarre à ${ELO_START} points. Chaque match joué compte (coefficient K = ${ELO_K}), plus ${BONUS_WIN} points par victoire`;
  $("lbn").textContent = fl
    ? `Classement fléchettes : ELO calculé uniquement avec les défis de fléchettes confirmés par l’adversaire. ${base}.`
    : {
        all: `Classement ELO général (tournois et défis) : ${base} et ${BONUS_TITLE} points pour chaque titre de tournoi. Les défis entre joueurs comptent une fois confirmés par l’adversaire.`,
        tournois: `Classement des tournois : ELO calculé uniquement avec les matchs de tournoi. ${base} et ${BONUS_TITLE} points pour chaque titre.`,
        defis: `Classement des défis : ELO calculé uniquement avec les défis confirmés. ${base}.`,
      }[leaderboardSource];
}
function addResult(t) {
  let r;
  try {
    r = extractTournoi(t);
  } catch (e) {
    return alert(e.message);
  }
  if (!r.matches.length) return alert("Aucun match joué dans ce tournoi.");
  if (
    r.open &&
    !confirm(
      r.open +
        " tableau(x) sans vainqueur (tournoi non terminé ?). Importer quand même ?",
    )
  )
    return;
  const name = $("rn").value.trim() || "Tournoi",
    date = $("rd").value || iso(new Date()),
    id = name + "|" + date;
  siteData.results = siteData.results.filter((x) => x.id !== id);
  siteData.results.push({
    id,
    name,
    date,
    matches: r.matches,
    champs: r.champs,
  });
  touch();
  renderBoard();
  renderOrganizer();
}
function importFile(i) {
  const f = i.files[0];
  if (f)
    f.text()
      .then((x) => addResult(JSON.parse(x)))
      .catch(() => alert("Fichier illisible."));
}
async function importRemote() {
  try {
    const r = await fetch(API + "/api/tournoi", { cache: "no-store" });
    const j = r.ok ? await r.json() : null;
    if (j) {
      addResult(j);
      return;
    }
  } catch (e) {}
  alert(
    "Aucun tournoi publié sur la page tournois (ou lecture impossible). Génère un tableau depuis l’onglet Tournois, ou charge tournoi.json avec « Importer un fichier ».",
  );
}
async function renameP() {
  const a = $("rnA").value.trim(),
    b = $("rnB").value.trim(),
    m = $("rnmsg");
  if (a.length < 2 || b.length < 2) {
    m.textContent = "Renseigne le nom à remplacer et le nom correct.";
    return;
  }
  const ka = pkey(a),
    fx = (x) => (pkey(x) === ka ? b : x);
  let n = 0;
  siteData.results.forEach((t) => {
    (t.matches || []).forEach((x) => {
      if (pkey(x.a) === ka) {
        x.a = b;
        n++;
      }
      if (pkey(x.b) === ka) {
        x.b = b;
        n++;
      }
    });
    if (t.champs)
      t.champs = t.champs.map((c) => {
        if (pkey(c) === ka) n++;
        return fx(c);
      });
  });
  if (n) touch();
  let nd = 0,
    err = "";
  for (const d of challenges.filter(
    (d) => pkey(d.a) === ka || pkey(d.b) === ka,
  )) {
    try {
      await dApi({
        action: "orga_update",
        id: d.id,
        sp: d.sp || "billard",
        a: fx(d.a),
        b: fx(d.b),
        w: d.w,
        score: d.score || "",
        status: d.status === "expired" ? "pending" : d.status,
      });
      nd++;
    } catch (e) {
      err = " Défis non modifiés : " + e.message + ".";
      break;
    }
  }
  if (nd) await loadDefis();
  renderBoard();
  renderOrganizer();
  $("rnmsg").textContent =
    (n || nd
      ? `${n} occurrence(s) renommée(s) dans les tournois, ${nd} défi(s) modifié(s).` +
        (n ? " Publie pour que ça apparaisse sur le site." : "")
      : "Aucun joueur trouvé avec ce nom.") + err;
}
function resDel(i) {
  if (confirm("Retirer ce tournoi du classement ?")) {
    siteData.results.splice(i, 1);
    touch();
    renderBoard();
    renderOrganizer();
  }
}
