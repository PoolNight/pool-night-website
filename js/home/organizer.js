let dirty = false,
  auto = false,
  pubBusy = false,
  pubAgain = false,
  pubTimer;
try {
  auto = localStorage.getItem("pn_auto") === "1";
} catch (e) {}
let organizerAuthenticated = false;

async function refreshOrganizer() {
  try {
    organizerAuthenticated = await organizerSession();
  } catch {
    organizerAuthenticated = false;
  }
  updateOrganizerView();
}

function updateOrganizerView() {
  $("login").hidden = organizerAuthenticated;
  $("orga").hidden = !organizerAuthenticated;
  if (organizerAuthenticated) renderOrganizer();
}

async function login(event) {
  event.preventDefault();
  const input = $("pw");
  const password = input.value;
  input.value = "";
  const error = $("lerr");
  try {
    organizerAuthenticated = await organizerSession("POST", password);
    error.textContent = organizerAuthenticated ? "" : "Mot de passe incorrect.";
    updateOrganizerView();
  } catch (cause) {
    error.textContent = cause.message;
  }
}

async function logout() {
  try {
    await organizerSession("DELETE");
    organizerAuthenticated = false;
    updateOrganizerView();
  } catch (cause) {
    st(cause.message);
  }
}
const st = (t) => {
  const s = $("ost");
  if (s) s.textContent = t;
};
function touch() {
  dirty = true;
  st("Modifications non publiées.");
  clearTimeout(pubTimer);
  if (auto && organizerAuthenticated) pubTimer = setTimeout(publish, 1500);
}
const autoSave = (v) => {
  auto = v;
  try {
    localStorage.setItem("pn_auto", v ? "1" : "0");
  } catch (e) {}
};
async function apiOrga(path, method, body, type) {
  let r;
  try {
    r = await fetch(path, {
      method,
      headers: type ? { "content-type": type } : {},
      body,
    });
  } catch (e) {
    throw new Error("serveur injoignable");
  }
  if (r.status === 401) {
    organizerAuthenticated = false;
    $("lerr").textContent = "Session expirée. Reconnecte-toi.";
    updateOrganizerView();
    throw new Error("session organisateur expirée");
  }
  if (r.status === 403) throw new Error("origine non autorisée");
  if (r.status === 429)
    throw new Error("trop d’essais, réessaie dans une heure");
  if (!r.ok) throw new Error("code " + r.status);
  return r;
}
async function publish() {
  if (!organizerAuthenticated) return;
  if (pubBusy) {
    pubAgain = true;
    return;
  }
  pubBusy = true;
  st("Publication en cours…");
  try {
    await apiOrga(
      "/api/donnees",
      "PUT",
      JSON.stringify(siteData),
      "application/json",
    );
    dirty = false;
    st(
      "Publié à " +
        new Date().toLocaleTimeString("fr-FR") +
        ". Visible tout de suite.",
    );
  } catch (e) {
    st("Échec de la publication (" + e.message + ").");
  }
  pubBusy = false;
  if (pubAgain) {
    pubAgain = false;
    publish();
  }
}
function exportData() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(siteData, null, 1)], { type: "application/json" }),
  );
  a.download = "data.json";
  a.click();
}
function renderOrganizer() {
  const e2 = (e) => {
    const p = isPast(e);
    return `<div class="oe" data-event-id="${esc(e.id)}"><div class="row"><input type="date" value="${esc(e.d)}" data-event-field="d" aria-label="Date"><input value="${esc(e.t)}" placeholder="Titre" data-event-field="t" aria-label="Titre"><input value="${esc(e.l)}" placeholder="Lieu" data-event-field="l" aria-label="Lieu"></div>
<textarea placeholder="Description" data-event-field="x" aria-label="Description">${esc(e.x)}</textarea>
<div class="row"><input value="${esc(e.img || "")}" placeholder="assets/affiche.jpg" data-event-field="img" aria-label="Chemin de l’affiche"><label class="btn alt sm">Téléverser une affiche<input type="file" accept="image/*" hidden data-event-upload></label></div>
<div class="row"><span class="tag ${p ? "p" : "u"}">${p ? "Passé" : "À venir"}</span><button class="btn alt sm" data-event-move>${p ? "Remettre à venir" : "Passer en évènement passé"}</button><button class="btn sm" data-event-delete>Supprimer</button></div></div>`;
  };
  $("orga").innerHTML =
    `<div class="frame"><h3 class="oh">Évènements</h3><button class="btn" onclick="evAdd()">Ajouter un évènement</button>${[
      ...siteData.events,
    ]
      .sort((a, b) => day(b.d) - day(a.d))
      .map(e2)
      .join("")}</div>
<div class="frame"><h3 class="oh">Classement</h3><p class="st">Après chaque tournoi, exporte tournoi.json depuis la page tournois, puis importe-le ici. Chaque match joué met à jour l’ELO des deux joueurs (les byes ne comptent pas). L’ordre des matchs est celui de la saisie des résultats, ou à défaut l’ordre logique des tours. Pour corriger un résultat, corrige-le dans la page tournois puis réimporte le fichier avec le même nom et la même date.</p>
<div class="row"><input id="rn" placeholder="Nom du tournoi" aria-label="Nom du tournoi"><input id="rd" type="date" value="${iso(new Date())}" aria-label="Date du tournoi"></div>
<div class="row"><label class="btn alt sm">Importer un fichier<input type="file" accept=".json" hidden onchange="importFile(this)"></label><button class="btn alt sm" onclick="importRemote()">Importer depuis le site tournois</button></div>
${siteData.results.map((t, i) => `<div class="row"><span>${esc(t.name)} · ${day(t.date).toLocaleDateString("fr-FR")} · ${t.matches ? t.matches.length + " matchs" : "ancien format, non compté"}</span><button class="btn sm" onclick="resDel(${i})">Retirer</button></div>`).join("") || '<p class="st">Aucun tournoi importé.</p>'}</div>
<div class="frame"><h3 class="oh">Corriger un nom de joueur</h3><p class="st">Remplace une orthographe par une autre dans tous les tournois enregistrés et dans les défis (majuscules, accents et ordre prénom/nom sont déjà ignorés). Les défis modifiés sont enregistrés tout de suite ; pour les tournois, pense à publier ensuite.</p>
<div class="row"><input id="rnA" placeholder="Nom à remplacer (ex. Virgile HOQUET-GALLET)" aria-label="Nom à remplacer"><input id="rnB" placeholder="Nom correct (ex. Virgile Hocquet-Gallet)" aria-label="Nom correct"><button class="btn" onclick="renameP()">Renommer</button></div>
<p class="st" id="rnmsg" role="status"></p></div>
${orgaDefis()}<div class="frame"><h3 class="oh">Publication</h3><p class="st">Les évènements et résultats publiés sont visibles tout de suite par tout le monde (aucun déploiement nécessaire).</p>
<div class="row"><label><input type="checkbox" id="ga"${auto ? " checked" : ""} onchange="autoSave(this.checked)"> Publier automatiquement</label></div>
<div class="row"><button class="btn" onclick="publish()">Publier</button><button class="btn alt sm" onclick="exportData()">Exporter data.json</button></div>
<p class="st" id="ost" role="status">${dirty ? "Modifications non publiées." : ""}</p></div>
<div class="frame"><div class="row"><button class="btn sm" onclick="logout()">Se déconnecter</button></div></div>`;
}

$("orga").addEventListener("input", (event) => {
  const field = event.target.closest("[data-event-field]");
  if (field)
    evSet(
      field.closest("[data-event-id]").dataset.eventId,
      field.dataset.eventField,
      field.value,
    );
});
$("orga").addEventListener("change", (event) => {
  const upload = event.target.closest("[data-event-upload]");
  if (upload) upImg(upload.closest("[data-event-id]").dataset.eventId, upload);
});
$("orga").addEventListener("click", (event) => {
  const button = event.target.closest("[data-event-move], [data-event-delete]");
  if (!button) return;
  const id = button.closest("[data-event-id]").dataset.eventId;
  if (button.hasAttribute("data-event-move")) evMove(id);
  else evDel(id);
});
