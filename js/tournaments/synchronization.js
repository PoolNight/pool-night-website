const API = "/api/tournoi";
const ORGA = new URLSearchParams(location.search).get("vue") === "orga";
let liveSync = true,
  organizerAuthenticated = false,
  organizerPoll,
  ghTimer,
  ghBusy = false,
  ghDirty = false;
try {
  liveSync = localStorage.getItem("pn_tournament_auto") !== "0";
} catch {}
const showSyncStatus = (t) => {
  $("ghs").textContent = t;
};
function renderSyncSettings() {
  $("ghA").checked = liveSync;
  showSyncStatus(
    liveSync
      ? "Synchronisation en direct activée."
      : "Synchronisation désactivée : tes modifications restent sur cet appareil.",
  );
}
function saveSyncSettings() {
  liveSync = $("ghA").checked;
  try {
    localStorage.setItem("pn_tournament_auto", liveSync ? "1" : "0");
  } catch {}
}
/* ---------- plusieurs organisateurs : synchronisation en direct ---------- */
let remoteRevision = 0,
  syncedSnapshot =
    null; /* remoteRevision : version en ligne que je connais ; syncedSnapshot : cette version (texte JSON) */
try {
  remoteRevision = +localStorage.getItem("poolnight_rev") || 0;
  syncedSnapshot = localStorage.getItem("poolnight_base");
} catch (e) {}
const isDirty = () =>
  syncedSnapshot === null || JSON.stringify(tournamentState) !== syncedSnapshot;
function markSynced(body, rev) {
  remoteRevision = rev;
  syncedSnapshot = body;
  try {
    localStorage.setItem("poolnight_rev", String(rev));
    localStorage.setItem("poolnight_base", body);
  } catch (e) {}
}
/* fusion à trois : base (dernière version synchronisée), mine (mes changements), theirs (version en ligne) */
function merge3(b, m, t) {
  const J = JSON.stringify,
    isO = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (J(m) === J(b)) return t;
  if (J(t) === J(b) || J(m) === J(t)) return m;
  if (isO(m) && isO(t)) {
    const bb = isO(b) ? b : {},
      o = {};
    new Set([...Object.keys(m), ...Object.keys(t)]).forEach((k) => {
      const v = merge3(bb[k], m[k], t[k]);
      if (v !== undefined) o[k] = v;
    });
    return o;
  }
  if (Array.isArray(m) && Array.isArray(t)) {
    const bb = Array.isArray(b) ? b : [],
      keyed = (a) =>
        a.every((x) => x && typeof x === "object" && x.id !== undefined);
    if (keyed(m) && keyed(t) && keyed(bb)) {
      const mp = (a) => new Map(a.map((x) => [x.id, x])),
        B = mp(bb),
        M = mp(m),
        T = mp(t),
        out = [];
      t.forEach((x) => {
        if (M.has(x.id)) out.push(merge3(B.get(x.id), M.get(x.id), x));
        else if (!B.has(x.id) || J(x) !== J(B.get(x.id)))
          out.push(x); /* ajouté ou modifié par l'autre */
      });
      m.forEach((x) => {
        if (!T.has(x.id) && (!B.has(x.id) || J(x) !== J(B.get(x.id))))
          out.push(x);
      }); /* ajouté ou modifié par moi */
      return out;
    }
    if (m.length === t.length && m.length === bb.length)
      return m.map((x, i) => merge3(bb[i], x, t[i]));
    return t; /* structure différente (tableau régénéré…) : la version en ligne l'emporte */
  }
  return m; /* même case modifiée des deux côtés : la mienne, la plus récente */
}
/* applique la version en ligne (d) : tel quel si je n'ai rien en attente, sinon fusion */
function applyRemote(d) {
  const rev = d._rev || 0;
  delete d._rev;
  if (!isDirty()) {
    tournamentState = d;
    clean();
    markSynced(JSON.stringify(tournamentState), rev);
    return;
  }
  const base = syncedSnapshot
    ? JSON.parse(syncedSnapshot)
    : { players: [], brackets: null, mode: "level" };
  tournamentState = merge3(base, tournamentState, d);
  clean();
  (tournamentState.brackets || []).forEach(prop);
  autoAssign();
  markSynced(
    JSON.stringify(d),
    rev,
  ); /* la différence entre tournamentState et cette version sera publiée */
  try {
    localStorage.setItem("poolnight", JSON.stringify(tournamentState));
  } catch (e) {}
}
async function publish(force) {
  if (!force && !liveSync) return;
  if (!organizerAuthenticated)
    return force && showSyncStatus("Connecte-toi à l’espace organisateur.");
  if (ghBusy) {
    ghDirty = true;
    return;
  }
  ghBusy = true;
  showSyncStatus("Synchronisation…");
  try {
    const body = JSON.stringify(tournamentState);
    const r = await fetch(API, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-base-rev": String(remoteRevision),
      },
      body,
    });
    if (r.status === 409) {
      applyRemote(await r.json());
      renderParticipants();
      ghDirty = true;
      showSyncStatus(
        "Fusionné avec les modifications d’un autre organisateur (" +
          new Date().toLocaleTimeString("fr-FR") +
          ").",
      );
    } else if (!r.ok) {
      if (r.status === 401) {
        endTournamentSession();
        $("tournament-login-error").textContent =
          "Session expirée. Reconnecte-toi.";
      }
      throw new Error(
        r.status === 401 ? "session expirée" : "code " + r.status,
      );
    } else {
      markSynced(body, (await r.json()).rev);
      showSyncStatus(
        "Synchronisé à " +
          new Date().toLocaleTimeString("fr-FR") +
          " : visible tout de suite par les autres organisateurs et les joueurs.",
      );
    }
  } catch (e) {
    showSyncStatus("Échec de la synchronisation (" + e.message + ").");
  }
  ghBusy = false;
  if (ghDirty) {
    ghDirty = false;
    publish();
  }
}
/* organisateur : au démarrage, on part de la version en ligne ; ensuite, sondage toutes les 3 secondes */
async function orgaStart() {
  try {
    const r = await fetch(API, { cache: "no-store" }),
      d = r.ok ? await r.json() : null;
    if (d) applyRemote(d);
    else if (tournamentState.players.length || tournamentState.brackets)
      publish(); /* rien en ligne : on envoie ce qu'on a */
  } catch (e) {}
  renderParticipants();
  if (organizerAuthenticated) organizerPoll = setInterval(orgaTick, 3000);
}
async function orgaTick() {
  if (!organizerAuthenticated || document.hidden || ghBusy) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#vO"))
    return; /* ne rien changer pendant qu'on écrit */
  if (isDirty() && liveSync) {
    publish();
    return;
  }
  try {
    const r = await fetch(API + "?since=" + remoteRevision, {
      cache: "no-store",
    });
    if (!r.ok) return;
    const d = await r.json();
    if (!d || d.same || (d._rev || 0) === remoteRevision) return;
    applyRemote(d);
    renderParticipants();
    showSyncStatus(
      "Mis à jour à " +
        new Date().toLocaleTimeString("fr-FR") +
        " (modification d’un autre organisateur).",
    );
    if (isDirty()) publish();
  } catch (e) {}
}
/* récupère la dernière version côté joueur */
async function pull() {
  if (ORGA) return false;
  try {
    let r = await fetch(API, { cache: "no-store" }),
      d = r.ok ? await r.json() : null;
    if (!d) {
      r = await fetch("tournoi.json?" + Date.now(), { cache: "no-store" });
      if (r.ok) d = await r.json();
    }
    if (d) {
      tournamentState = d;
      clean();
      return true;
    }
  } catch (e) {}
  return false;
}
