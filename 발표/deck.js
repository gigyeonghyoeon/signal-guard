SG.mountOverlay = function () {
  if (document.getElementById("doc-overlay")) return;
  const wrap = document.createElement("div");
  wrap.id = "doc-overlay";
  wrap.innerHTML =
    '<div class="doc-main"><button type="button" class="doc-close" id="doc-close">닫기 Esc</button><div id="doc-view"></div></div>';
  document.body.appendChild(wrap);
  wrap.querySelector("#doc-close").onclick = () => SG.closeDoc();
};

SG.openDoc = async function (id) {
  SG.mountOverlay();
  const overlay = document.getElementById("doc-overlay");
  overlay.classList.add("open");
  document.documentElement.classList.add("doc-open");
  document.body.classList.add("doc-open");
  const doc = SG.findDoc(id) || SG_DOCS[0];
  const view = document.getElementById("doc-view");
  view.innerHTML = "<p class='note'>불러오는 중…</p>";
  SG._openId = doc.id;
  if (location.hash !== "#doc=" + doc.id) {
    history.replaceState(null, "", "#doc=" + doc.id);
  }
  await SG.renderDocInto(view, doc);
  const overlayEl = document.getElementById("doc-overlay");
  overlayEl.scrollTop = 0;
  if (doc.heading) {
    const target = Array.from(view.querySelectorAll("h1, h2, h3")).find((n) =>
      n.textContent.indexOf(doc.heading) !== -1
    );
    if (target) target.scrollIntoView({ block: "start" });
  }
};

SG.closeDoc = function () {
  const overlay = document.getElementById("doc-overlay");
  if (overlay) overlay.classList.remove("open");
  document.documentElement.classList.remove("doc-open");
  document.body.classList.remove("doc-open");
  SG._openId = null;
  const n = document.getElementById("pos");
  if (n) history.replaceState(null, "", "#" + n.textContent);
  else history.replaceState(null, "", location.pathname + location.search);
};

(function () {
  const deck = document.getElementById("deck");
  const tpl = document.getElementById("slides");
  if (!deck || !tpl) return;

  const slides = Array.from(tpl.content.querySelectorAll(".slide"));
  slides.forEach((s) => deck.appendChild(s));

  let i = 0;
  const total = slides.length;
  const pos = document.getElementById("pos");
  const totalEl = document.getElementById("total");
  const bar = document.getElementById("bar");
  if (totalEl) totalEl.textContent = String(total);

  function go(n) {
    i = Math.max(0, Math.min(total - 1, n));
    slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
    if (pos) pos.textContent = String(i + 1);
    if (bar) bar.style.width = ((i + 1) / total) * 100 + "%";
    const overlay = document.getElementById("doc-overlay");
    if (!overlay || !overlay.classList.contains("open")) {
      history.replaceState(null, "", "#" + (i + 1));
    }
  }

  function fromHash() {
    const h = location.hash.replace("#", "");
    if (h.startsWith("doc=")) {
      const id = decodeURIComponent(h.slice(4));
      if (SG._openId === id) return;
      SG.openDoc(id);
      return;
    }
    SG.closeDoc();
    const n = parseInt(h, 10);
    go(Number.isFinite(n) ? n - 1 : 0);
  }

  document.getElementById("prev").onclick = () => {
    SG.closeDoc();
    go(i - 1);
  };
  document.getElementById("next").onclick = () => {
    SG.closeDoc();
    go(i + 1);
  };

  window.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("doc-overlay");
    const open = overlay && overlay.classList.contains("open");
    if (open && e.key === "Escape") {
      e.preventDefault();
      SG.closeDoc();
      return;
    }
    if (open) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
      e.preventDefault();
      go(i + 1);
    }
    if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
      e.preventDefault();
      go(i - 1);
    }
    if (e.key === "Home") go(0);
    if (e.key === "End") go(total - 1);
  });

  let touchX = null;
  window.addEventListener("touchstart", (e) => {
    touchX = e.changedTouches[0].clientX;
  });
  window.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx < -40) go(i + 1);
    if (dx > 40) go(i - 1);
    touchX = null;
  });

  window.addEventListener("hashchange", fromHash);

  document.querySelectorAll("[data-open-doc]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      SG.openDoc(btn.getAttribute("data-open-doc"));
    });
  });

  fromHash();
})();
