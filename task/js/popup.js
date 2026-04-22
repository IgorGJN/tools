const PopupNews = (function () {
  const CONFIG = {
    popupId: "v402",
    enabled: true
  };

  const STORAGE_KEY = "popup_seen_ids";

  function init() {
    if (!CONFIG.enabled) return;

    const seen = getSeenPopups();
    if (seen.includes(CONFIG.popupId)) return;

    open();
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

  function bindEvents() {
    document.getElementById("newsCloseBtn")?.addEventListener("click", close);
    document.querySelector(".news-overlay")?.addEventListener("click", close);
  }

  function getSeenPopups() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
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

  return {
    init
  };
})();