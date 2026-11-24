const DEFAULT_EVENTS = [
  /* date au format AAAA-MM-JJ. Une fois l'espace organisateur utilisé, c'est data.json qui fait foi. */
  {
    id: "e0",
    d: "2026-10-31",
    t: "Halloween Night",
    l: "",
    x: "Soirée billard spéciale Halloween.",
    img: "assets/ev-halloween.jpg",
  },
  {
    id: "e1",
    d: "2026-10-28",
    t: "Soirée PoolNight",
    l: "23 av. de Fontainebleau, 94270 Le Kremlin-Bicêtre",
    x: "Une soirée billard entre amis. Merci à tous ceux qui sont venus !",
    img: "assets/ev-28-octobre.jpg",
  },
  {
    id: "e2",
    d: "2026-10-14",
    t: "Soirée PoolNight",
    l: "",
    x: "Retour en images sur la soirée du 14 octobre.",
    img: "assets/ev-14-octobre.jpg",
  },
];
const DATA_PATH = "data.json";
let siteData = { events: DEFAULT_EVENTS.map((e) => ({ ...e })), results: [] };
const API =
  location.protocol === "file:"
    ? "https://pool-night.netlify.app"
    : ""; /* même adresse que le site ; l'adresse complète ne sert que pour ouvrir le fichier en local */
async function loadSiteData() {
  let j = null;
  try {
    const r = await fetch(API + "/api/donnees?" + Date.now(), {
      cache: "no-store",
    });
    if (r.ok) j = await r.json();
  } catch (e) {}
  if (!j || !Array.isArray(j.events)) {
    try {
      const r = await fetch(DATA_PATH + "?" + Date.now());
      if (r.ok) j = await r.json();
    } catch (e) {}
  } /* repli : data.json du dépôt */
  if (j && Array.isArray(j.events) && !dirty) {
    siteData = { events: j.events, results: j.results || [] };
    renderEvents();
    renderBoard();
    if (location.hash === "#organisateur" && organizerAuthenticated)
      renderOrganizer();
  }
}
