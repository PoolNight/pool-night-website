function show(v) {
  $("tournament-login").classList.toggle("hide", v !== "login");
  $("vO").classList.toggle("hide", v !== "org");
  $("vP").classList.toggle("hide", v !== "pl");
  $("tO").classList.toggle("on", v !== "pl");
  $("tP").classList.toggle("on", v === "pl");
}
async function go(view) {
  if (view === "pl") {
    show("pl");
    return;
  }
  try {
    organizerAuthenticated = await organizerSession();
  } catch {
    organizerAuthenticated = false;
  }
  if (!organizerAuthenticated) {
    endTournamentSession();
    return;
  }
  await openTournamentOrganizer();
}

async function openTournamentOrganizer() {
  organizerAuthenticated = true;
  show("org");
  if (organizerPoll === undefined) await orgaStart();
}

function endTournamentSession() {
  organizerAuthenticated = false;
  clearInterval(organizerPoll);
  organizerPoll = undefined;
  show("login");
}

async function loginTournament(event) {
  event.preventDefault();
  const input = $("tournament-password");
  const password = input.value;
  input.value = "";
  const error = $("tournament-login-error");
  try {
    if (await organizerSession("POST", password)) {
      error.textContent = "";
      await openTournamentOrganizer();
    } else {
      error.textContent = "Mot de passe incorrect.";
    }
  } catch (cause) {
    error.textContent = cause.message;
  }
}

async function logoutTournament() {
  try {
    await organizerSession("DELETE");
    endTournamentSession();
  } catch (cause) {
    showSyncStatus(cause.message);
  }
}

function qr() {
  const u = EMBED
    ? location.origin + location.pathname.replace(/[^/]*$/, "") + "#tournois"
    : location.href.split("#")[0].split("?")[0];
  $("qrurl").textContent = u;
  $("qr").innerHTML = "";
  try {
    new QRCode($("qr"), { text: u, width: 160, height: 160 });
  } catch (e) {}
}
(async () => {
  if (ORGA) {
    await go("org");
  } else {
    await pull();
    document.querySelector("nav").classList.add("hide");
    go("pl");
  }
  renderParticipants();
  qr();
  renderSyncSettings();
  if (!ORGA)
    setInterval(() => {
      if (searched && !document.hidden) findMe(true);
    }, 20000);
})();
/* mode intégré : prévient le site principal de la hauteur de la page */
if (EMBED && parent !== window) {
  const send = () =>
    parent.postMessage(
      { pnH: Math.ceil(document.body.getBoundingClientRect().height) + 8 },
      "*",
    );
  new ResizeObserver(send).observe(document.body);
  addEventListener("load", send);
  send();
}
setInterval(updateMatchTimers, 1000);
