const PopupNews = (function () {

  const CONFIG = {
    popupId: "love90",
    enabled: true,
    htmlPath: "popup.html"
  };

  const STORAGE_KEY = "popup_seen_ids";

  async function init() {
    if (!CONFIG.enabled) return;

    const seen = getSeenPopups();

    if (seen.includes(CONFIG.popupId)) return;

    await loadHtml();
    open();
  }

  async function loadHtml() {
    if (document.getElementById("newsPopup")) return;

    try {
      const res = await fetch(CONFIG.htmlPath);
      const html = await res.text();

      const container = document.createElement("div");
      container.innerHTML = html;

      document.body.appendChild(container.firstElementChild);

    } catch (e) {
      console.error("Erro ao carregar popup:", e);
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

  function bindEvents() {
    document.getElementById("newsCloseBtn")?.addEventListener("click", close);

    document.querySelector(".news-overlay")?.addEventListener("click", close);

    document.querySelector(".news-action")?.addEventListener("click", close);
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