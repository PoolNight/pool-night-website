let tournamentState = { players: [], brackets: null, mode: "level" };
try {
  const x = JSON.parse(localStorage.getItem("poolnight"));
  if (x) tournamentState = x;
} catch (e) {}
const clean = () => {
  if (tournamentState.brackets && tournamentState.brackets.some((b) => !b.secs))
    tournamentState.brackets = null;
};
clean();
const saveTournament = () => {
  try {
    localStorage.setItem("poolnight", JSON.stringify(tournamentState));
  } catch (e) {}
  clearTimeout(ghTimer);
  ghTimer = setTimeout(() => publish(), 600);
};
const findPlayer = (id) => tournamentState.players.find((p) => p.id === id);
const uid = () => Math.random().toString(36).slice(2, 9);
function exportJson() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(tournamentState)], { type: "application/json" }),
  );
  a.download = "tournoi.json";
  a.click();
}
function resetAll() {
  if (confirm("Effacer participants et tableau ?")) {
    tournamentState = {
      players: [],
      brackets: null,
      mode: "level",
      tmin: tournamentState.tmin || 0,
      tables: (tournamentState.tables || []).map((t) => ({ ...t, acc: 0 })),
    };
    saveTournament();
    renderParticipants();
  }
}
