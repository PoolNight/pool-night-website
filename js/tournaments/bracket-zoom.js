let Z = 1;
try {
  Z = parseFloat(localStorage.getItem("pn_zoom")) || 1;
} catch (e) {}
const ZMIN = 0.3,
  ZMAX = 1.6;
function setZ(z, save) {
  const old = Z;
  Z = Math.min(ZMAX, Math.max(ZMIN, z));
  const sc = [...document.querySelectorAll(".scroll")],
    mid = sc.map((e) => e.scrollLeft + e.clientWidth / 2);
  document.documentElement.style.setProperty("--z", Z);
  sc.forEach((e, i) => {
    e.scrollLeft = mid[i] * (Z / old) - e.clientWidth / 2;
  }); /* garde le même centre */
  document
    .querySelectorAll(".zp")
    .forEach((e) => (e.textContent = Math.round(Z * 100) + "%"));
  if (save)
    try {
      localStorage.setItem("pn_zoom", String(Z));
    } catch (e) {}
}
function zoomBy(d) {
  setZ(Z * (d > 0 ? 1.2 : 1 / 1.2), true);
}
function zoomFit() {
  const bs = [...document.querySelectorAll(".bracket")];
  if (!bs.length) return;
  setZ(1);
  const w = Math.max(...bs.map((b) => b.scrollWidth)),
    a = Math.min(
      ...[...document.querySelectorAll(".scroll")].map((e) => e.clientWidth),
    );
  setZ(Math.min(1, (a / w) * 0.99), true);
}
setZ(Z);
(() => {
  const d = (t) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let p0 = 0,
    z0 = 1;
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2 && e.target.closest(".scroll")) {
        p0 = d(e.touches);
        z0 = Z;
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (p0 && e.touches.length === 2) {
        e.preventDefault();
        setZ((z0 * d(e.touches)) / p0);
      }
    },
    { passive: false },
  );
  document.addEventListener("touchend", (e) => {
    if (p0 && e.touches.length < 2) {
      p0 = 0;
      try {
        localStorage.setItem("pn_zoom", String(Z));
      } catch (x) {}
    }
  });
  document.addEventListener(
    "wheel",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.target.closest(".scroll")) {
        e.preventDefault();
        setZ(Z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), true);
      }
    },
    { passive: false },
  );
})();
