const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s) => {
  const [y, m, d] = (s || iso(new Date())).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const t0 = new Date();
t0.setHours(0, 0, 0, 0);
const isPast = (e) => e.p === "past" || (e.p !== "up" && day(e.d) < t0);
function replaceMissingEventImage(el) {
  el.outerHTML = '<div class="noimg"><img src="assets/logo.jpg" alt=""></div>';
}
const card = (e, past) => {
  const d = day(e.d);
  return `<article class="ev${past ? " past" : ""}"${past ? "" : ` onclick="window.open(LINKTREE||INSTA,'_blank','noopener')" onkeydown="if(event.key==='Enter')this.click()" tabindex="0" role="link"`}>${e.img ? `<img src="${esc(e.img)}" alt="Affiche : ${esc(e.t)}" loading="lazy" onerror="replaceMissingEventImage(this)">` : '<div class="noimg"><img src="assets/logo.jpg" alt=""></div>'}<div class="evb"><div class="date"><b>${d.getDate()}</b>${d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</div><h3>${esc(e.t)}</h3>${e.l ? `<p class="lieu">${esc(e.l)}</p>` : ""}<p>${esc(e.x)}</p></div></article>`;
};
function renderEvents() {
  const up = siteData.events
      .filter((e) => !isPast(e))
      .sort((a, b) => day(a.d) - day(b.d)),
    past = siteData.events.filter(isPast).sort((a, b) => day(b.d) - day(a.d));
  $("up").innerHTML = up.length
    ? up.map((e) => card(e, false)).join("")
    : '<div class="empty">Pas d’évènement annoncé pour le moment. Suis-nous sur Instagram pour les prochaines dates !</div>';
  $("past").innerHTML = past.length
    ? past.map((e) => card(e, true)).join("")
    : '<div class="empty">Aucun évènement passé.</div>';
  const n = $("next");
  if (up.length) {
    n.hidden = false;
    n.innerHTML = `Prochain rendez-vous : <b>${esc(up[0].t)}</b>, le ${day(up[0].d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`;
  } else n.hidden = true;
}
const ev = (id) => siteData.events.find((e) => e.id === id);
function evSet(id, k, v) {
  ev(id)[k] = v;
  touch();
  renderEvents();
}
function evAdd() {
  siteData.events.push({
    id: "e" + Date.now(),
    d: iso(new Date()),
    t: "Nouvel évènement",
    l: "",
    x: "",
    img: "",
  });
  touch();
  renderEvents();
  renderOrganizer();
}
function evDel(id) {
  if (confirm("Supprimer cet évènement ?")) {
    siteData.events = siteData.events.filter((e) => e.id !== id);
    touch();
    renderEvents();
    renderOrganizer();
  }
}
function evMove(id) {
  const e = ev(id);
  e.p = isPast(e) ? "up" : "past";
  touch();
  renderEvents();
  renderOrganizer();
}
async function upImg(id, input) {
  const f = input.files[0];
  if (!f) return;
  try {
    st("Téléversement de l’affiche…");
    const bm = await createImageBitmap(f),
      s = Math.min(1, 900 / bm.width),
      c = document.createElement("canvas");
    c.width = Math.round(bm.width * s);
    c.height = Math.round(bm.height * s);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    const name = "ev-" + Date.now() + ".jpg";
    await apiOrga("/api/affiche/" + name, "PUT", blob, "image/jpeg");
    evSet(id, "img", "/api/affiche/" + name);
    renderOrganizer();
    st("Affiche téléversée. Pense à publier pour l’associer à l’évènement.");
  } catch (e) {
    st("Échec du téléversement (" + e.message + ").");
  }
}
