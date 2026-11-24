const EMBED = new URLSearchParams(location.search).get("embed") === "1";
if (EMBED) document.documentElement.classList.add("emb");
