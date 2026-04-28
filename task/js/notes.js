const NotesApp = (function () {
  const NOTES_STORAGE_KEY = "tasks_tool_notes_v2";
  const AUTH_STORAGE_KEY = "tasks_tool_auth_v1";
  const LAST_SYNC_KEY = "tasks_tool_notes_last_sync_v1";
  const PENDING_SYNC_KEY = "tasks_tool_notes_pending_sync_v1";

  const AUTO_SYNC_INTERVAL_MS = 1000 * 60 * 5;

  const state = {
    notes: [],
    activeId: "",
    search: "",
    tag: "",
    autosaveTimer: null,
    isSyncing: false,
    pendingSync: localStorage.getItem(PENDING_SYNC_KEY) === "true"
  };

  const refs = {
    closeNotesBtn: document.getElementById("closeNotesBtn"),
    newNoteBtn: document.getElementById("newNoteBtn"),
    saveNoteBtn: document.getElementById("saveNoteBtn"),
    deleteNoteBtn: document.getElementById("deleteNoteBtn"),
    syncNotesBtn: document.getElementById("syncNotesBtn"),
    favoriteNoteBtn: document.getElementById("favoriteNoteBtn"),
    closeEditorBtn: document.getElementById("closeEditorBtn"),
    clearTagFilterBtn: document.getElementById("clearTagFilterBtn"),

    notesList: document.getElementById("notesList"),
    notesTagsPanel: document.getElementById("notesTagsPanel"),
    notesSearchInput: document.getElementById("notesSearchInput"),
    notesCountLabel: document.getElementById("notesCountLabel"),

    noteEditorPanel: document.getElementById("noteEditorPanel"),
    editorTitle: document.getElementById("editorTitle"),
    noteTitle: document.getElementById("noteTitle"),
    noteHashtags: document.getElementById("noteHashtags"),
    noteContent: document.getElementById("noteContent"),

    noteStatus: document.getElementById("noteStatus"),
    notesSyncInfo: document.getElementById("notesSyncInfo")
  };

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "note-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeHashtags(input) {
    if (Array.isArray(input)) {
      return Array.from(
        new Set(
          input
            .map(function (tag) {
              return String(tag || "")
                .trim()
                .replace(/^#+/, "")
                .toLowerCase();
            })
            .filter(Boolean)
        )
      );
    }

    return String(input || "")
      .split(/[\s,]+/)
      .map(function (tag) {
        return tag.trim().replace(/^#+/, "").toLowerCase();
      })
      .filter(Boolean)
      .filter(function (tag, index, list) {
        return list.indexOf(tag) === index;
      });
  }

  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function getCurrentUsername() {
    const auth = getAuth();

    return String(
      (auth && auth.user && auth.user.username) ||
      (auth && auth.username) ||
      ""
    )
      .trim()
      .toLowerCase();
  }

  function normalizeNote(note) {
    const now = new Date().toISOString();

    return {
      id: String(note.id || generateId()),
      owner: String(note.owner || getCurrentUsername()).trim().toLowerCase(),
      title: String(note.title || "").trim(),
      content: String(note.content || ""),
      hashtags: normalizeHashtags(note.hashtags || []),
      favorite:
        note.favorite === true ||
        String(note.favorite).toLowerCase() === "true",
      createdAt: String(note.createdAt || now),
      updatedAt: String(note.updatedAt || note.createdAt || now),
      deleted:
        note.deleted === true ||
        String(note.deleted).toLowerCase() === "true",
      deletedAt: String(note.deletedAt || "")
    };
  }

  function markPendingSync(value) {
    state.pendingSync = value === true;
    localStorage.setItem(PENDING_SYNC_KEY, state.pendingSync ? "true" : "false");
  }

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || "[]");
      state.notes = Array.isArray(saved) ? saved.map(normalizeNote) : [];
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      state.notes = [];
    }
  }

  function saveNotes(options) {
    const config = {
      markPending: true,
      ...options
    };

    localStorage.setItem(
      NOTES_STORAGE_KEY,
      JSON.stringify(state.notes.map(normalizeNote))
    );

    if (config.markPending) {
      markPendingSync(true);
      updateSyncInfo();
    }
  }

  function setStatus(text) {
    if (refs.noteStatus) {
      refs.noteStatus.textContent = text;
    }
  }

  function updateSyncInfo(text) {
    if (!refs.notesSyncInfo) {
      return;
    }

    if (text) {
      refs.notesSyncInfo.textContent = text;
      return;
    }

    const lastSync = localStorage.getItem(LAST_SYNC_KEY);

    if (state.isSyncing) {
      refs.notesSyncInfo.textContent = "Sincronizando notas...";
      return;
    }

    if (state.pendingSync) {
      refs.notesSyncInfo.textContent = "Alterações locais pendentes de sincronização";
      return;
    }

    if (!lastSync) {
      refs.notesSyncInfo.textContent = "Sincronização: nunca";
      return;
    }

    const date = new Date(lastSync);

    if (isNaN(date.getTime())) {
      refs.notesSyncInfo.textContent = "Sincronização: nunca";
      return;
    }

    refs.notesSyncInfo.textContent =
      "Última sincronização: " + date.toLocaleString("pt-BR");
  }

  function getActiveNote() {
    return (
      state.notes.find(function (note) {
        return note.id === state.activeId && !note.deleted;
      }) || null
    );
  }

  function getVisibleNotes() {
  const search = state.search.trim().toLowerCase();
  const tag = state.tag;
  const currentUser = getCurrentUsername();

  return state.notes
    .filter(function (note) {
      if (note.deleted) return false;
      if (!currentUser) return false;
      if (!isNoteFromCurrentUser(note)) return false;

      const joinedText = [
        note.title,
        note.content,
        Array.isArray(note.hashtags) ? note.hashtags.join(" ") : ""
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || joinedText.includes(search);
      const matchesTag = !tag || note.hashtags.includes(tag);

      return matchesSearch && matchesTag;
    })
    .sort(function (a, b) {
      if (a.favorite !== b.favorite) {
        return a.favorite ? -1 : 1;
      }

      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
}

  function getAllTags() {
  const counts = {};

  state.notes.forEach(function (note) {
    if (note.deleted) return;
    if (!isNoteFromCurrentUser(note)) return;

    note.hashtags.forEach(function (tag) {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  return Object.keys(counts)
    .map(function (tag) {
      return {
        tag: tag,
        count: counts[tag]
      };
    })
    .sort(function (a, b) {
      return b.count - a.count || a.tag.localeCompare(b.tag);
    });
}

  function hashString(value) {
    const text = String(value || "default");
    let hash = 0;

    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash);
  }

  function getNoteColorClass(note) {
    const tags = Array.isArray(note.hashtags) ? note.hashtags : [];
    const key = tags[0] || note.title || note.id || "default";
    return "note-card-color-" + (hashString(key) % 8);
  }

  function formatNoteDate(dateString) {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short"
    });
  }

  function renderTags() {
    if (!refs.notesTagsPanel) {
      return;
    }

    const tags = getAllTags();

    if (!tags.length) {
      refs.notesTagsPanel.innerHTML =
        '<span class="tag-chip active">Sem hashtags</span>';
      return;
    }

    let html = "";

    html +=
      '<button class="tag-chip' +
      (state.tag === "" ? " active" : "") +
      '" data-tag="">Todas</button>';

    tags.forEach(function (item) {
      html +=
        '<button class="tag-chip' +
        (state.tag === item.tag ? " active" : "") +
        '" data-tag="' +
        escapeHtml(item.tag) +
        '">#' +
        escapeHtml(item.tag) +
        " · " +
        item.count +
        "</button>";
    });

    refs.notesTagsPanel.innerHTML = html;
  }

  function renderList() {
    if (!refs.notesList) {
      return;
    }

    const notes = getVisibleNotes();

    if (refs.notesCountLabel) {
      refs.notesCountLabel.textContent =
        notes.length + " " + (notes.length === 1 ? "nota" : "notas");
    }

    if (!notes.length) {
      refs.notesList.innerHTML =
        '<div class="empty-note-card">' +
        '<strong>Nenhuma nota encontrada</strong>' +
        '<span>Crie uma nova nota ou ajuste os filtros.</span>' +
        "</div>";
      return;
    }

    let html = "";

    notes.forEach(function (note) {
      const colorClass = getNoteColorClass(note);
      const preview = note.content ? note.content.slice(0, 170) : "Sem conteúdo";

      html +=
        '<button class="note-card ' +
        colorClass +
        (note.id === state.activeId ? " active" : "") +
        '" data-note-id="' +
        escapeHtml(note.id) +
        '" type="button">';

      html += '<div class="note-card-top">';
      html += '<strong>' + escapeHtml(note.title || "Sem título") + "</strong>";
      html +=
        '<span class="note-card-star">' +
        (note.favorite ? "⭐" : "✎") +
        "</span>";
      html += "</div>";

      html += "<p>" + escapeHtml(preview) + "</p>";

      if (note.hashtags.length) {
        html += '<div class="note-card-tags">';

        note.hashtags.slice(0, 3).forEach(function (tag) {
          html += "<span>#" + escapeHtml(tag) + "</span>";
        });

        if (note.hashtags.length > 3) {
          html += "<span>+" + (note.hashtags.length - 3) + "</span>";
        }

        html += "</div>";
      }

      html += '<div class="note-card-footer">';
      html += "<span>" + escapeHtml(formatNoteDate(note.updatedAt)) + "</span>";
      html += "<span>" + (note.favorite ? "Fixada" : "Abrir") + "</span>";
      html += "</div>";

      html += "</button>";
    });

    refs.notesList.innerHTML = html;
  }

  function renderEditor() {
    const note = getActiveNote();

    if (!note) {
      refs.noteEditorPanel.classList.add("hidden");
      return;
    }

    refs.noteEditorPanel.classList.remove("hidden");

    refs.editorTitle.textContent = note.title || "Sem título";
    refs.noteTitle.value = note.title || "";
    refs.noteHashtags.value = note.hashtags
      .map(function (tag) {
        return "#" + tag;
      })
      .join(", ");
    refs.noteContent.value = note.content || "";

    refs.deleteNoteBtn.disabled = false;
    refs.favoriteNoteBtn.textContent = note.favorite ? "★" : "☆";
  }

  function refresh() {
    renderTags();
    renderList();
    renderEditor();
    updateSyncInfo();
  }

  function openEditor(noteId) {
    state.activeId = noteId;
    refresh();

    setTimeout(function () {
      if (refs.noteTitle) {
        refs.noteTitle.focus();
      }
    }, 80);
  }

  function closeEditor() {
    state.activeId = "";
    refresh();
  }

  function createNote() {
    const now = new Date().toISOString();

    const note = normalizeNote({
      id: generateId(),
      owner: getCurrentUsername(),
      title: "Nova nota",
      content: "",
      hashtags: [],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: ""
    });

    state.notes.push(note);
    state.activeId = note.id;

    saveNotes({ markPending: true });
    refresh();
    setStatus("Nova nota criada.");

    setTimeout(function () {
      refs.noteTitle.focus();
      refs.noteTitle.select();
    }, 120);
  }

  function saveActiveNote(options) {
    const config = {
  syncAfterSave: false,
  showMessage: true,
  closeAfterSave: false,
  ...options
};

    const note = getActiveNote();

    if (!note) {
      return;
    }

    note.title = refs.noteTitle.value.trim() || "Sem título";
    note.content = refs.noteContent.value;
    note.hashtags = normalizeHashtags(refs.noteHashtags.value);
    note.updatedAt = new Date().toISOString();

    saveNotes({ markPending: true });
    renderTags();
    renderList();
    refs.editorTitle.textContent = note.title;

    if (config.showMessage) {
      setStatus("Nota salva localmente.");
    } else {
      setStatus("Salvo localmente.");
    }

    if (config.syncAfterSave) {
      syncNotes({ silent: false });
    }
    if (config.closeAfterSave) {
  setTimeout(function () {
    closeEditor();
  }, 120);
}
  }

  function scheduleAutoSave() {
    clearTimeout(state.autosaveTimer);

    state.autosaveTimer = setTimeout(function () {
      saveActiveNote({
        syncAfterSave: false,
        showMessage: false
      });
    }, 500);
  }

  function deleteActiveNote() {
    const note = getActiveNote();

    if (!note) {
      return;
    }

    const confirmed = window.confirm("Excluir esta nota?");

    if (!confirmed) {
      return;
    }

    const now = new Date().toISOString();

    note.deleted = true;
    note.deletedAt = now;
    note.updatedAt = now;

    state.activeId = "";
    saveNotes({ markPending: true });
    refresh();
    setStatus("Nota excluída localmente.");

    syncNotes({ silent: false });
  }

  function toggleFavorite() {
    const note = getActiveNote();

    if (!note) {
      return;
    }

    note.favorite = !note.favorite;
    note.updatedAt = new Date().toISOString();

    saveNotes({ markPending: true });
    refresh();
    setStatus(note.favorite ? "Nota fixada no topo." : "Nota removida dos favoritos.");
  }

  function mergeNotes(localNotes, remoteNotes) {
    const map = {};

    localNotes.concat(remoteNotes || []).forEach(function (rawNote) {
      const note = normalizeNote(rawNote);
      const existing = map[note.id];

      if (
        !existing ||
        new Date(note.updatedAt).getTime() >
          new Date(existing.updatedAt).getTime()
      ) {
        map[note.id] = note;
      }
    });

    return Object.keys(map).map(function (id) {
      return map[id];
    });
  }

  async function syncNotes(options) {
    const config = {
      silent: false,
      force: false,
      ...options
    };

    const auth = getAuth();

    if (!auth || !auth.username || !auth.password) {
      if (!config.silent) {
        setStatus("Entre no app de tarefas antes de sincronizar as notas.");
      }
      return;
    }

    if (!window.TaskSync || typeof window.TaskSync.syncNotes !== "function") {
      console.log("TaskSync atual:", window.TaskSync);
      if (!config.silent) {
        setStatus("Função TaskSync.syncNotes ainda não configurada.");
      }
      return;
    }

    if (state.isSyncing) {
      return;
    }

    if (!navigator.onLine) {
      if (!config.silent) {
        setStatus("Sem internet. Nota salva localmente.");
      }
      updateSyncInfo();
      return;
    }

    if (!state.pendingSync && !config.force) {
      if (!config.silent) {
        setStatus("Nada novo para sincronizar.");
      }
      updateSyncInfo();
      return;
    }

    try {
      state.isSyncing = true;
      updateSyncInfo("Sincronizando notas...");

      if (!config.silent) {
        setStatus("Sincronizando...");
      }

      const result = await window.TaskSync.syncNotes(state.notes, auth);
      const remoteNotes =
        result && Array.isArray(result.notes) ? result.notes : [];

      state.notes = mergeNotes(state.notes, remoteNotes);
      state.notes = state.notes.filter(function (note) {
  return isNoteFromCurrentUser(note);
});
      saveNotes({ markPending: false });

      markPendingSync(false);
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

      refresh();

      if (!config.silent) {
        setStatus("Notas sincronizadas.");
      } else {
        setStatus("Notas sincronizadas em segundo plano.");
      }
    } catch (error) {
      console.error("Erro ao sincronizar notas:", error);
      updateSyncInfo();

      if (!config.silent) {
        setStatus("Erro ao sincronizar: " + error.message);
      }
    } finally {
      state.isSyncing = false;
      updateSyncInfo();
    }
  }

  function startAutoSync() {
    setInterval(function () {
      if (!state.pendingSync) {
        return;
      }

      syncNotes({
        silent: true,
        force: false
      });
    }, AUTO_SYNC_INTERVAL_MS);
  }

  function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme") || "default";

    document.documentElement.classList.remove(
      "light",
      "blue",
      "green",
      "red",
      "yellow"
    );

    if (savedTheme && savedTheme !== "default" && savedTheme !== "dark") {
      document.documentElement.classList.add(savedTheme);
    }
  }

  function bindEvents() {
    refs.closeNotesBtn.addEventListener("click", function () {
      window.location.href = "./index.html";
    });

    refs.newNoteBtn.addEventListener("click", createNote);

    refs.saveNoteBtn.addEventListener("click", function () {
  saveActiveNote({
    syncAfterSave: true,
    showMessage: true,
    closeAfterSave: true
  });
});

    refs.deleteNoteBtn.addEventListener("click", deleteActiveNote);

    refs.syncNotesBtn.addEventListener("click", function () {
      syncNotes({
        silent: false,
        force: true
      });
    });

    refs.favoriteNoteBtn.addEventListener("click", toggleFavorite);

    if (refs.closeEditorBtn) {
      refs.closeEditorBtn.addEventListener("click", closeEditor);
    }

    if (refs.clearTagFilterBtn) {
      refs.clearTagFilterBtn.addEventListener("click", function () {
        state.tag = "";
        refresh();
      });
    }

    refs.notesSearchInput.addEventListener("input", function (event) {
      state.search = event.target.value;
      renderList();
    });

    refs.notesTagsPanel.addEventListener("click", function (event) {
      const button = event.target.closest("[data-tag]");

      if (!button) {
        return;
      }

      state.tag = button.dataset.tag || "";
      refresh();
    });

    refs.notesList.addEventListener("click", function (event) {
      const button = event.target.closest("[data-note-id]");

      if (!button) {
        return;
      }

      openEditor(button.dataset.noteId);
    });

    refs.noteTitle.addEventListener("input", scheduleAutoSave);
    refs.noteHashtags.addEventListener("input", scheduleAutoSave);
    refs.noteContent.addEventListener("input", scheduleAutoSave);

    window.addEventListener("online", function () {
      if (state.pendingSync) {
        syncNotes({
          silent: true,
          force: false
        });
      }
    });

    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        saveActiveNote({
          syncAfterSave: true,
          showMessage: true
        });
      }

      if (event.key === "Escape" && state.activeId) {
        closeEditor();
      }
    });
  }

  function isNoteFromCurrentUser(note) {
  const currentUser = getCurrentUsername();
  const owner = String(note.owner || "").trim().toLowerCase();

  if (!currentUser) {
    return false;
  }

  return owner === currentUser;
}

  function init() {
    applySavedTheme();
    loadNotes();

    state.activeId = "";

    bindEvents();
    refresh();
    startAutoSync();

    if (navigator.onLine && state.pendingSync) {
      setTimeout(function () {
        syncNotes({
          silent: true,
          force: false
        });
      }, 1500);
    }
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  NotesApp.init();
});