const PopupNews = (function () {
  const CONFIG = {
    popupId: "v.2.2.2",
    enabled: true,
    delayMs: 400
  };

  const STORAGE_KEY = "popup_seen_ids";

  function getSeenPopups() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function saveSeen(id) {
    const seen = getSeenPopups();

    if (!seen.includes(id)) {
      seen.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }
  }

  function bindEvents() {
    const closeBtn = document.getElementById("newsCloseBtn");
    const overlay = document.querySelector(".news-overlay");

    if (closeBtn) {
      closeBtn.onclick = close;
    }

    if (overlay) {
      overlay.onclick = close;
    }
  }

  function open() {
    const el = document.getElementById("newsPopup");
    if (!el) return;

    el.classList.remove("hidden");
    bindEvents();
  }

  function close() {
    const el = document.getElementById("newsPopup");
    if (!el) return;

    el.classList.add("hidden");
    saveSeen(CONFIG.popupId);
  }

  function init() {
    if (!CONFIG.enabled) return;

    const seen = getSeenPopups();
    if (seen.includes(CONFIG.popupId)) return;

    setTimeout(function () {
      open();
    }, CONFIG.delayMs);
  }

  return {
    init: init,
    open: open,
    close: close
  };
})();