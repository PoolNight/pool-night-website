const ORGANIZER_SESSION_API = "/api/organisateur";

// Remove credentials and the UI login flag saved by earlier versions.
try {
  sessionStorage.removeItem("pn_orga");
  sessionStorage.removeItem("pn_okey");
} catch {}
try {
  const previous = JSON.parse(localStorage.getItem("poolnight_gh"));
  localStorage.removeItem("poolnight_gh");
  if (typeof previous?.auto === "boolean") {
    localStorage.setItem("pn_tournament_auto", previous.auto ? "1" : "0");
  }
} catch {
  try {
    localStorage.removeItem("poolnight_gh");
  } catch {}
}

async function organizerSession(method = "GET", password) {
  const headers = password === undefined ? {} : { "x-organizer-key": password };
  const response = await fetch(ORGANIZER_SESSION_API, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) return true;
  if (response.status === 401) return false;
  if (response.status === 429)
    throw new Error("Trop d’essais. Réessaie dans une heure.");
  throw new Error("Service de connexion indisponible.");
}
