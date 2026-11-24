const DEFI_API = API + "/api/defis";
let challenges = [],
  challengeLinkParams = null,
  requiresBoardApproval = false;
const lsGet = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  lsSet = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
async function dApi(body) {
  const h = { "content-type": "application/json" };
  let r;
  try {
    r = await fetch(DEFI_API, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Impossible de joindre le serveur des défis.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erreur " + r.status);
  return j;
}
async function loadDefis() {
  try {
    const r = await fetch(DEFI_API + "?" + Date.now());
    if (!r.ok) return;
    const j = await r.json();
    challenges = Array.isArray(j.defis) ? j.defis : [];
    requiresBoardApproval = !!j.validation;
  } catch (e) {
    return;
  }
  renderBoard();
  renderDefiLog();
  renderMine();
  defiCheck();
}
const defiLink = (x) =>
  (location.protocol === "file:"
    ? location.href.split("#")[0]
    : location.origin + location.pathname) +
  "#classement?defi=" +
  x.id +
  "&k=" +
  x.ck;
const mineOf = (id) => (lsGet("pn_defis") || []).find((x) => x.id === id);
function defiOpen() {
  challengeLinkParams = null;
  $("defi").hidden = false;
  renderDefiForm();
  $("defi").scrollIntoView({ behavior: "smooth", block: "start" });
}
function defiClose() {
  $("defi").hidden = true;
}
function defiLeave() {
  challengeLinkParams = null;
  $("defi").hidden = true;
  try {
    history.replaceState(null, "", "#classement");
  } catch (e) {}
}
function renderDefiForm() {
  const me = lsGet("pn_me") || "",
    names = [
      ...new Set(
        [...board("all", "billard"), ...board("all", "flechettes")].map(
          (x) => x.name,
        ),
      ),
    ];
  $("defi").innerHTML = `<h3 class="oh">Défie un ami</h3>
<p class="st">Joue ton match, saisis le résultat puis envoie le lien à ton adversaire. Le match compte pour l’ELO dès qu’il le confirme.</p>
<datalist id="dnames">${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
<div class="row"><select id="dsp" aria-label="Sport" onchange="dSport(this.value)"><option value="billard"${selectedSport === "billard" ? " selected" : ""}>🎱 Billard</option><option value="flechettes"${selectedSport === "flechettes" ? " selected" : ""}>🎯 Fléchettes</option></select></div>
<div class="row"><input id="dme" list="dnames" value="${esc(me)}" placeholder="Ton Prénom NOM" aria-label="Ton nom"><input id="dop" list="dnames" placeholder="Prénom NOM de l’adversaire" aria-label="Nom de l’adversaire"></div>
<div class="row"><select id="dw" aria-label="Résultat"><option value="0">J’ai gagné</option><option value="1">J’ai perdu</option></select><input id="dsc" placeholder="Score (facultatif) ex. 5-3" maxlength="10" aria-label="Score"></div>
<div class="row"><button class="btn" id="dgo" onclick="defiSend()">Envoyer le défi</button><button class="btn alt sm" onclick="defiClose()">Fermer</button></div>
<p class="st" id="dmsg" role="status"></p><div id="dmine"></div>`;
  renderMine();
}
async function defiSend() {
  const a = $("dme").value.trim(),
    b = $("dop").value.trim(),
    w = +$("dw").value,
    score = $("dsc").value.trim(),
    m = $("dmsg");
  m.textContent = "";
  $("dgo").disabled = true;
  try {
    const r = await dApi({
      action: "create",
      sp: $("dsp").value,
      a,
      b,
      w,
      score,
    });
    lsSet("pn_me", a);
    const L = lsGet("pn_defis") || [];
    L.unshift({ id: r.id, ck: r.ck, dk: r.dk, a, b, w, score, t: Date.now() });
    lsSet("pn_defis", L.slice(0, 30));
    await loadDefis();
    m.textContent =
      "Défi enregistré ! Envoie le lien à " +
      b +
      " (lien ci-dessous) pour qu’il le confirme.";
    $("dop").value = "";
    $("dsc").value = "";
  } catch (e) {
    m.textContent = e.message;
  }
  $("dgo").disabled = false;
}
function renderMine() {
  const el = $("dmine");
  if (!el) return;
  const L = (lsGet("pn_defis") || [])
    .map((x) => ({
      x,
      d:
        challenges.find((c) => c.id === x.id) ||
        (x.a && Date.now() - x.t < 12e4
          ? {
              id: x.id,
              a: x.a,
              b: x.b,
              w: x.w,
              score: x.score,
              status: "pending",
            }
          : null),
    }))
    .filter((y) => y.d)
    .slice(0, 6);
  el.innerHTML = L.length
    ? '<h4 class="dh">Mes défis</h4>' +
      L.map(({ x, d }) => {
        const w = d.w === 0 ? d.a : d.b,
          l = d.w === 0 ? d.b : d.a,
          st =
            {
              pending: "En attente de " + d.b,
              awaiting: "Validation du bureau en cours",
              confirmed: "Confirmé",
              rejected: "Contesté",
              expired: "Expiré",
            }[d.status] || d.status;
        return `<div class="oe"><div class="row"><span>${d.sp === "flechettes" ? "🎯 " : ""}<b>${esc(w)}</b> bat ${esc(l)}${d.score ? " (" + esc(d.score) + ")" : ""}</span><span class="tag ${d.status === "pending" ? "u" : "p"}">${esc(st)}</span></div>${d.status === "pending" ? `<div class="row"><input readonly value="${esc(defiLink(x))}" onclick="this.select()" aria-label="Lien à envoyer à l’adversaire" class="challenge-share-link"></div><div class="row"><button class="btn sm" onclick="defiShare('${x.id}')">Partager le lien</button><button class="btn alt sm" onclick="defiCopy('${x.id}')">Copier le lien</button><button class="btn alt sm" onclick="defiCancel('${x.id}')">Annuler</button></div>` : ""}</div>`;
      }).join("")
    : "";
}
async function defiCopy(id) {
  const x = mineOf(id);
  if (!x) return;
  const u = defiLink(x),
    m = $("dmsg");
  try {
    await navigator.clipboard.writeText(u);
    if (m) m.textContent = "Lien copié.";
  } catch (e) {
    prompt("Copie ce lien :", u);
  }
}
function defiShare(id) {
  const x = mineOf(id),
    d = challenges.find((c) => c.id === id);
  if (!x || !d) return;
  const text = `${d.a} ${d.w === 0 ? "dit t’avoir battu" : "dit avoir perdu contre toi"} à PoolNight. Confirme le résultat :`;
  if (navigator.share)
    navigator
      .share({ title: "Défi PoolNight", text, url: defiLink(x) })
      .catch(() => {});
  else defiCopy(id);
}
async function defiCancel(id) {
  const x = mineOf(id);
  if (!x) return;
  try {
    await dApi({ action: "cancel", id, dk: x.dk });
    lsSet(
      "pn_defis",
      (lsGet("pn_defis") || []).filter((y) => y.id !== id),
    );
    await loadDefis();
  } catch (e) {
    const m = $("dmsg");
    if (m) m.textContent = e.message;
  }
}
function defiCheck() {
  if (!challengeLinkParams) return;
  const d = challenges.find((c) => c.id === challengeLinkParams.id),
    el = $("defi");
  el.hidden = false;
  if (!d) {
    el.innerHTML =
      '<h3 class="oh">Défi introuvable</h3><p class="st">Ce lien n’est plus valable.</p><button class="btn alt sm" onclick="defiLeave()">Fermer</button>';
    return;
  }
  el.innerHTML =
    `<h3 class="oh">Confirme un défi</h3><p class="lead">${d.sp === "flechettes" ? "🎯 Fléchettes · " : ""}<b>${esc(d.a)}</b> ${d.w === 0 ? "dit t’avoir battu" : "dit avoir perdu contre toi"}${d.score ? " (" + esc(d.score) + ")" : ""}.</p><p class="st">Défi adressé à ${esc(d.b)}.</p>` +
    (d.status === "pending"
      ? `<p class="st">Si c’est exact, confirme : le match sera compté dans l’ELO des deux joueurs.</p><div class="row"><button class="btn" onclick="defiAnswer(true)">C’est exact</button><button class="btn alt" onclick="defiAnswer(false)">Je conteste</button></div><p class="st" id="dmsg" role="status"></p>`
      : `<p class="st">Ce défi est déjà ${{ confirmed: "confirmé", awaiting: "confirmé, en attente de validation du bureau", rejected: "contesté", expired: "expiré" }[d.status] || "clos"}.</p><button class="btn alt sm" onclick="defiLeave()">Fermer</button>`);
}
async function defiAnswer(ok) {
  if (!challengeLinkParams) return;
  try {
    await dApi({
      action: "confirm",
      id: challengeLinkParams.id,
      ck: challengeLinkParams.k,
      accept: ok,
    });
    await loadDefis();
  } catch (e) {
    const m = $("dmsg");
    if (m) m.textContent = e.message;
  }
}
function renderDefiLog() {
  const c = challenges
      .filter(
        (d) =>
          d.status === "confirmed" && (d.sp || "billard") === selectedSport,
      )
      .sort((a, b) => (b.tc || b.t) - (a.tc || a.t))
      .slice(0, 8),
    p = challenges.filter(
      (d) => d.status === "pending" || d.status === "awaiting",
    ).length;
  $("dflog").innerHTML =
    c.length || p
      ? '<h3 class="oh">Derniers défis</h3>' +
        c
          .map((d) => {
            const w = d.w === 0 ? d.a : d.b,
              l = d.w === 0 ? d.b : d.a;
            return `<div class="dfl"><span><b>${esc(w)}</b> bat ${esc(l)}${d.score ? " (" + esc(d.score) + ")" : ""}</span><span>${new Date(d.tc || d.t).toLocaleDateString("fr-FR")}</span></div>`;
          })
          .join("") +
        (p
          ? `<p class="st">${p} défi${p > 1 ? "s" : ""} en attente de confirmation ou de validation.</p>`
          : "")
      : "";
}
function orgaDefis() {
  const sel = (v, arr) =>
    arr
      .map(
        ([k, t]) =>
          `<option value="${k}"${String(v) === String(k) ? " selected" : ""}>${t}</option>`,
      )
      .join("");
  const rows = challenges
    .map(
      (
        d,
      ) => `<div class="oe"><div class="row"><select id="osp_${d.id}" aria-label="Sport"><option value="billard"${(d.sp || "billard") === "billard" ? " selected" : ""}>Billard</option><option value="flechettes"${d.sp === "flechettes" ? " selected" : ""}>Fléchettes</option></select><input id="oa_${d.id}" value="${esc(d.a)}" aria-label="Joueur A"><span>contre</span><input id="ob_${d.id}" value="${esc(d.b)}" aria-label="Joueur B"></div>
<div class="row"><select id="ow_${d.id}" aria-label="Vainqueur">${sel(d.w, [
        [0, "A gagne"],
        [1, "B gagne"],
      ])}</select><input id="os_${d.id}" value="${esc(d.score || "")}" placeholder="Score" size="7" aria-label="Score"><select id="ot_${d.id}" aria-label="Statut">${sel(
        d.status,
        [
          ["pending", "En attente"],
          ["awaiting", "À valider (confirmé par l’adversaire)"],
          ["confirmed", "Confirmé"],
          ["rejected", "Contesté"],
          ["void", "Annulé par l’orga"],
          ["expired", "Expiré"],
        ],
      )}</select></div>
<div class="row"><span class="st">Déclaré le ${new Date(d.t).toLocaleString("fr-FR")}${d.tc ? " · traité le " + new Date(d.tc).toLocaleString("fr-FR") : ""}${d.edited ? " · modifié par l’orga" : ""}</span>${d.status === "awaiting" ? `<button class="btn sm" onclick="defiOrgaValidate('${d.id}')">Valider</button>` : ""}<button class="btn sm" onclick="defiOrgaSave('${d.id}')">Enregistrer</button><button class="btn alt sm" onclick="defiOrgaDel('${d.id}')">Supprimer</button></div></div>`,
    )
    .join("");
  return `<div class="frame"><h3 class="oh">Défis des joueurs</h3><p class="st">Tous les défis déclarés. Si un résultat est truqué : change le vainqueur, passe-le en « Annulé » ou supprime-le, l’ELO est recalculé aussitôt pour tout le monde. Seul un défi « Confirmé » compte. A est le joueur qui a déclaré le défi.</p>
<div class="row"><label><input type="checkbox" id="oval"${requiresBoardApproval ? " checked" : ""} onchange="defiOrgaCfg(this.checked)"> Validation obligatoire par le bureau (un défi confirmé par l’adversaire ne compte qu’après ton « Valider »)</label></div>
<div class="row"><button class="btn alt sm" onclick="loadDefis().then(renderOrganizer)">Actualiser la liste</button></div>
<p class="st" id="odmsg" role="status"></p>${rows || '<p class="st">Aucun défi pour le moment.</p>'}</div>`;
}
async function defiOrgaSave(id) {
  const g = (k) => $(k + "_" + id).value,
    m = $("odmsg");
  try {
    await dApi({
      action: "orga_update",
      id,
      sp: g("osp"),
      a: g("oa"),
      b: g("ob"),
      w: +g("ow"),
      score: g("os"),
      status: g("ot") === "expired" ? "pending" : g("ot"),
    });
    await loadDefis();
    renderOrganizer();
    $("odmsg").textContent = "Enregistré, ELO recalculé.";
  } catch (e) {
    m.textContent = e.message;
  }
}
function defiOrgaValidate(id) {
  $("ot_" + id).value = "confirmed";
  defiOrgaSave(id);
}
async function defiOrgaCfg(v) {
  try {
    await dApi({ action: "orga_config", validation: v });
    requiresBoardApproval = v;
    $("odmsg").textContent = v
      ? "Validation du bureau activée."
      : "Validation du bureau désactivée.";
  } catch (e) {
    $("oval").checked = !v;
    $("odmsg").textContent = e.message;
  }
}
async function defiOrgaDel(id) {
  if (!confirm("Supprimer définitivement ce défi ?")) return;
  try {
    await dApi({ action: "orga_delete", id });
    await loadDefis();
    renderOrganizer();
    $("odmsg").textContent = "Défi supprimé, ELO recalculé.";
  } catch (e) {
    $("odmsg").textContent = e.message;
  }
}
