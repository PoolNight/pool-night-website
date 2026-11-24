const LINKTREE = "https://linktr.ee/clubpoolnight"; // lien du link-tree (vide = redirige vers Instagram)
const INSTA =
  "https://www.instagram.com/clubpoolnight?utm_source=ig_web_button_share_sheet&srtk=ZDNlZDc0MzIxNw==";
const BUREAU = [
  {
    n: "Pierre-Louis Rouchette",
    r: "Président",
    d: "Mister WoWyde, au service des passionnés·ées de billard.",
    img: "assets/bureau-1.png",
  },
  {
    n: "Joseph Devin",
    r: "Vice-président",
    d: '"Je suis le bon jo 🪕"',
    img: "assets/bureau-2.png",
  },
  {
    n: "Adrien Le Berre",
    r: "Trésorier",
    d: "Trésorier sur le papier, tout le reste en vrai.",
    img: "assets/bureau-3.jpg",
  },
  {
    n: "Tanguy De-Jerphanion",
    r: "Respo dev",
    d: "Staff +++",
    img: "assets/bureau-4.png",
  },
];
document
  .querySelectorAll("[data-lt]")
  .forEach((a) => (a.href = LINKTREE || INSTA));
document.querySelectorAll("[data-insta]").forEach((a) => (a.href = INSTA));

$("team").innerHTML = BUREAU.map(
  (m) =>
    `<article class="polaroid member"><div class="ph"><img src="${esc(m.img)}" alt="Photo de ${esc(m.n)}" loading="lazy" onerror="this.remove()"></div><h3>${esc(m.n)}</h3><p class="role">${esc(m.r)}</p><p>${esc(m.d)}</p></article>`,
).join("");
