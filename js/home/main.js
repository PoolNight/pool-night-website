renderEvents();
renderBoard();
show();
loadDefis();
loadSiteData();

const membershipCard = $("membership-card");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  membershipCard.play().catch(() => {
    // The poster remains visible if the browser blocks autoplay.
  });
}
