function status(b, me) {
  if (chmp(b) === me) return "Tu as gagné le tournoi !";
  let pre = "";
  if (b.type === "po") {
    const gi = b.groups.findIndex((g) => g.ps.includes(me)),
      g = b.groups[gi],
      st = stand(g),
      pos = st.rows.findIndex((r) => r.id === me) + 1,
      L = "Poule " + String.fromCharCode(65 + gi);
    if (!st.done) {
      const open = g.ms
        .filter((m) => m.w === null && (m.a === me || m.b === me))
        .map((m) => {
          const o = findPlayer(m.a === me ? m.b : m.a);
          return o.p + " " + o.n;
        });
      return `${L} : ${pos}e pour l’instant. Il te reste à jouer contre ${open.join(", ")}.`;
    }
    if (pos > b.q)
      return `Éliminé·e en ${L.toLowerCase()} (${pos}e). Merci d’avoir joué !`;
    pre = `Qualifié·e (${pos}e de la ${L.toLowerCase()}). `;
  }
  let last = null;
  b.secs.forEach((s) =>
    s.rounds.forEach((R, r) =>
      R.forEach((m) => {
        if (m.a === me || m.b === me)
          last = { m, l: (s.t ? s.t + " · " : "") + s.titles[r] };
      }),
    ),
  );
  if (!last) return "Ton tableau n’a pas encore commencé.";
  const { m, l } = last;
  if (m.w === null) {
    const o = findPlayer(m.a === me ? m.b : m.a),
      tn = m.tb ? tbName(m.tb) : "",
      tt = tn ? ` Rendez-vous à la ${tn}.` : "";
    return (
      pre +
      (o
        ? `${l} : ton adversaire est ${o.p} ${o.n}.${tt}`
        : `${l} : adversaire pas encore connu.`)
    );
  }
  if (m.w === me) return pre + "Tu avances ! Adversaire pas encore connu.";
  return `Éliminé·e (${l}). Merci d’avoir joué !`;
}
let searched = false;
async function findMe(auto) {
  await pull();
  searched = true;
  const q = norm($("jp").value + " " + $("jn").value)
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
  const p = tournamentState.players.find(
    (p) =>
      norm(p.p + " " + p.n)
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(" ") === q,
  );
  const out = $("me");
  if (!tournamentState.brackets || !tournamentState.brackets.length) {
    out.innerHTML =
      '<div class="empty">Le tournoi n’est pas encore publié. Reviens un peu plus tard.</div>';
    return;
  }
  if (!p) {
    out.innerHTML =
      '<div class="empty">Aucun inscrit à ce nom. Vérifie l’orthographe du prénom et du nom saisis sur HelloAsso.</div>';
    return;
  }
  const b = tournamentState.brackets.find((b) =>
    b.type === "po"
      ? b.groups.some((g) => g.ps.includes(p.id))
      : b.secs[0].rounds[0].some((m) => m.a === p.id || m.b === p.id),
  );
  if (!b) {
    out.innerHTML =
      '<div class="empty">Tu es inscrit·e mais pas dans un tableau. Vois avec l’organisateur.</div>';
    return;
  }
  out.innerHTML =
    `<div class="status">${esc(status(b, p.id))}</div><p class="hint">${esc(p.p)} ${esc(p.n)} · niveau ${esc(p.l)}. Ton chemin est entouré en rouge.</p>` +
    bHtml(b, p.id, false);
  const n = out.querySelector(".now");
  if (n && auto !== true)
    n.scrollIntoView({ block: "center", inline: "center" });
}
