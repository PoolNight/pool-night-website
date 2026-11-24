/* queue de billard sous l'onglet actif : au changement d'onglet, elle pousse la boule jusqu'au nouvel onglet */
const cueEl = $("cue"),
  ballEl = $("ball"),
  ballIn = ballEl.firstElementChild,
  CD = 12,
  CT = 8;
let cueTab = null,
  cueF = 1,
  cueRun = 0,
  cueAnims = [];
const calm = matchMedia("(prefers-reduced-motion:reduce)"),
  sleep = (ms) => new Promise((f) => setTimeout(f, ms));
function cueRest(a, f) {
  const L = a.offsetLeft,
    W = a.offsetWidth,
    sw = Math.max(20, W - 12 - CD),
    y = a.offsetTop + a.offsetHeight - 4;
  return f > 0
    ? { sl: L + 6, sw, bl: L + 6 + sw, y }
    : { bl: L + 6, sl: L + 6 + CD, sw, y };
}
function cueApply(r, f) {
  cueEl.style.cssText = `left:${r.sl}px;top:${r.y}px;width:${r.sw}px;transform:scaleX(${f})`;
  ballEl.style.cssText = `left:${r.bl}px;top:${r.y - (CD - CT) / 2}px`;
  ballIn.style.transform = "";
}
function cueAnim(el, kf, ms, ease, delay) {
  const an = el.animate(kf, {
    duration: ms,
    easing: ease,
    delay: delay || 0,
    fill: "forwards",
  });
  cueAnims.push(an);
  return an.finished;
}
async function moveCue(a) {
  const my = ++cueRun;
  cueAnims.forEach((x) => x.cancel());
  cueAnims = [];
  if (!a) {
    cueEl.classList.add("off");
    ballEl.classList.add("off");
    cueTab = null;
    return;
  }
  const prev = cueTab,
    off = cueEl.classList.contains("off");
  if (prev && !off)
    cueApply(
      cueRest(prev, cueF),
      cueF,
    ); /* si une animation était en cours : on la termine d'un coup */
  const dir = prev ? Math.sign(a.offsetLeft - prev.offsetLeft) || 1 : 1;
  if (!prev || off || a === prev || calm.matches) {
    cueTab = a;
    cueApply(cueRest(a, cueF), cueF);
    cueEl.classList.remove("off");
    ballEl.classList.remove("off");
    return;
  }
  const live = () => my === cueRun;
  let f = cueF,
    r0 = cueRest(prev, f);
  cueTab = a;
  try {
    if (f !== dir) {
      /* la queue se retourne côté sens de marche */
      cueEl.classList.add("off");
      ballEl.classList.add("off");
      await sleep(210);
      if (!live()) return;
      f = dir;
      r0 = cueRest(prev, f);
      cueApply(r0, f);
      cueEl.classList.remove("off");
      ballEl.classList.remove("off");
      await sleep(210);
      if (!live()) return;
    }
    cueF = f;
    const to = cueRest(a, f),
      S = (o, dx) => ({
        left: o.sl + (dx || 0) + "px",
        width: o.sw + "px",
        top: o.y + "px",
      });
    await cueAnim(cueEl, [S(r0), S(r0, -12 * f)], 190, "ease-out");
    if (!live()) return; /* la queue recule */
    await cueAnim(cueEl, [S(r0, -12 * f), S(r0)], 90, "ease-in");
    if (!live()) return; /* coup */
    const dist = to.bl - r0.bl,
      deg = (dist / (Math.PI * CD)) * 360;
    await Promise.all([
      cueAnim(
        ballEl,
        [
          { left: r0.bl + "px", top: r0.y - 2 + "px" },
          { left: to.bl + "px", top: to.y - 2 + "px" },
        ],
        640,
        "cubic-bezier(.1,.8,.2,1)",
      ),
      cueAnim(
        ballIn,
        [{ transform: "rotate(0deg)" }, { transform: `rotate(${deg}deg)` }],
        640,
        "cubic-bezier(.1,.8,.2,1)",
      ),
      cueAnim(cueEl, [S(r0), S(to)], 820, "cubic-bezier(.25,.6,.3,1)"),
    ]);
    if (!live()) return;
    cueApply(to, f);
    cueAnims.forEach((x) => x.cancel());
    cueAnims = [];
  } catch (e) {}
}
addEventListener("resize", () => {
  if (cueTab) moveCue(cueTab);
});
if (document.fonts)
  document.fonts.ready.then(() => {
    if (cueTab) moveCue(cueTab);
  });
const TABS = [
  "presentation",
  "bureau",
  "tournois",
  "evenements",
  "classement",
  "organisateur",
];
function show() {
  const [h, q] = location.hash.slice(1).split("?"),
    t = TABS.includes(h) ? h : "presentation";
  if (q) {
    const pr = new URLSearchParams(q),
      id = pr.get("defi"),
      k = pr.get("k");
    if (/^[a-f0-9]{12}$/.test(id || "") && /^[a-f0-9]{24}$/.test(k || ""))
      challengeLinkParams = { id, k };
  } else if (challengeLinkParams) {
    challengeLinkParams = null;
    $("defi").hidden = true;
  }
  TABS.forEach((n) => {
    $("p-" + n).hidden = n !== t;
    const a = $("t-" + n);
    if (a)
      n === t
        ? a.setAttribute("aria-current", "page")
        : a.removeAttribute("aria-current");
  });
  moveCue($("t-" + t));
  if (t === "tournois") {
    const f = $("ftour"),
      src =
        "tournois.html?embed=1" +
        (new URLSearchParams(q || "").get("vue") === "orga" ? "&vue=orga" : "");
    if (f.getAttribute("src") !== src) f.src = src;
  }
  if (challengeLinkParams) defiCheck();
  if (t === "organisateur") refreshOrganizer();
}
addEventListener("hashchange", show);
addEventListener("message", (e) => {
  const f = $("ftour");
  if (
    f &&
    e.source === f.contentWindow &&
    e.data &&
    typeof e.data.pnH === "number"
  )
    f.style.height = Math.max(300, e.data.pnH) + "px";
});
addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
