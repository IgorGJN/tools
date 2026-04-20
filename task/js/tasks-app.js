const App = (function () {
  const state = {
    filters: {
      search: "",
      status: "all",
      sort: "smart",
      tag: "",
      date: ""
    },
    pendingDeleteId: null
  };

  const refs = {
    newTaskBtn: document.getElementById("newTaskBtn"),
    syncBtn: document.getElementById("syncBtn"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingText: document.getElementById("loadingText"),
    lastSyncInfo: document.getElementById("lastSyncInfo"),

    taskModal: document.getElementById("taskModal"),
    confirmModal: document.getElementById("confirmModal"),
    taskForm: document.getElementById("taskForm"),
    taskId: document.getElementById("taskId"),
    taskTitle: document.getElementById("taskTitle"),
    taskDescription: document.getElementById("taskDescription"),
    taskDate: document.getElementById("taskDate"),
    taskTime: document.getElementById("taskTime"),
    taskHashtags: document.getElementById("taskHashtags"),
    taskRecurring: document.getElementById("taskRecurring"),
    recurrenceFields: document.getElementById("recurrenceFields"),
    taskRecurrenceType: document.getElementById("taskRecurrenceType"),
    taskRecurrenceInterval: document.getElementById("taskRecurrenceInterval"),
    modalTitle: document.getElementById("modalTitle"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    sortMode: document.getElementById("sortMode"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    taskList: document.getElementById("taskList"),
    hashtagsPanel: document.getElementById("hashtagsPanel")
  };

  function showLoading(text) {
    if (!refs.loadingText || !refs.loadingOverlay) {
      return;
    }

    refs.loadingText.textContent = text || "Carregando...";
    refs.loadingOverlay.classList.remove("hidden");
    refs.loadingOverlay.setAttribute("aria-hidden", "false");
  }

  function hideLoading() {
    if (!refs.loadingOverlay) {
      return;
    }

    refs.loadingOverlay.classList.add("hidden");
    refs.loadingOverlay.setAttribute("aria-hidden", "true");
  }

  function formatLastSync(dateString) {
    if (!dateString) {
      return "Última sincronização: nunca";
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return "Última sincronização: nunca";
    }

    return "Última sincronização: " + date.toLocaleString("pt-BR");
  }

  function updateLastSyncInfo() {
    if (!refs.lastSyncInfo) {
      return;
    }

    refs.lastSyncInfo.textContent = formatLastSync(TaskStore.getLastSync());
  }

  function showSyncSuccess() {
    if (!refs.syncBtn) {
      return;
    }

    const originalText = "Sincronizar";

    refs.syncBtn.textContent = "✔ Sincronizado";
    refs.syncBtn.classList.add("btn-success");
    refs.syncBtn.disabled = true;

    setTimeout(function () {
      refs.syncBtn.textContent = originalText;
      refs.syncBtn.classList.remove("btn-success");
      refs.syncBtn.disabled = false;
    }, 2000);
  }

  function updateRecurrenceVisibility() {
    if (!refs.taskRecurring || !refs.recurrenceFields) {
      return;
    }

    if (refs.taskRecurring.checked) {
      refs.recurrenceFields.classList.remove("hidden");
    } else {
      refs.recurrenceFields.classList.add("hidden");
    }
  }

  function getAllTasks() {
    return TaskStore.load();
  }

  function getVisibleTasks() {
    const tasks = getAllTasks();
    let filtered = TaskStore.filterTasks(tasks, state.filters);

    if (state.filters.date) {
      filtered = filtered.filter(function (task) {
        return task.date === state.filters.date;
      });
    }

    return TaskStore.sortTasks(filtered, state.filters.sort);
  }

  function refresh() {
    const allTasks = getAllTasks();
    const visibleTasks = getVisibleTasks();

    TaskUI.renderSummary(TaskStore.buildSummary(allTasks));
    TaskUI.renderHashtags(TaskStore.allHashtags(allTasks), state.filters.tag);
    TaskUI.renderTasks(visibleTasks);
    TaskUI.renderUpcoming(TaskStore.getUpcoming(allTasks));
    TaskCalendar.render(allTasks);
  }

  function openModal(task) {
    refs.taskForm.reset();
    refs.taskDate.value = TaskStore.todayISO();
    refs.taskTime.value = "";
    refs.taskId.value = "";
    refs.modalTitle.textContent = "Nova tarefa";
    refs.taskRecurring.checked = false;
    refs.taskRecurrenceType.value = "daily";
    refs.taskRecurrenceInterval.value = 1;
    updateRecurrenceVisibility();

    if (task) {
      refs.modalTitle.textContent = "Editar tarefa";
      refs.taskId.value = task.id;
      refs.taskTitle.value = task.title || "";
      refs.taskDescription.value = task.description || "";
      refs.taskDate.value = TaskUI.normalizeDate(task.date || "");
      refs.taskTime.value = TaskUI.normalizeTime(task.time || "");
      refs.taskHashtags.value = (task.hashtags || [])
        .map(function (tag) {
          return "#" + tag;
        })
        .join(", ");

      refs.taskRecurring.checked = task.recurring === true;
      refs.taskRecurrenceType.value = task.recurrenceType || "daily";
      refs.taskRecurrenceInterval.value = task.recurrenceInterval || 1;
      updateRecurrenceVisibility();
    }

    refs.taskModal.classList.remove("hidden");
    refs.taskModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    refs.taskModal.classList.add("hidden");
    refs.taskModal.setAttribute("aria-hidden", "true");
  }

  function openConfirm(id) {
    state.pendingDeleteId = id;
    refs.confirmModal.classList.remove("hidden");
    refs.confirmModal.setAttribute("aria-hidden", "false");
  }

  function closeConfirm() {
    state.pendingDeleteId = null;
    refs.confirmModal.classList.add("hidden");
    refs.confirmModal.setAttribute("aria-hidden", "true");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      title: refs.taskTitle.value,
      description: refs.taskDescription.value,
      date: refs.taskDate.value,
      time: refs.taskTime.value,
      hashtags: refs.taskHashtags.value,
      recurring: refs.taskRecurring.checked,
      recurrenceType: refs.taskRecurrenceType.value,
      recurrenceInterval: refs.taskRecurrenceInterval.value
    };

    if (!payload.title.trim()) {
      TaskUI.showToast("Informe um título para a tarefa.");
      return;
    }

    if (!payload.date) {
      TaskUI.showToast("Informe uma data para a tarefa.");
      return;
    }

    const existingId = refs.taskId.value;

    if (existingId) {
      TaskStore.updateTask(existingId, payload);
      TaskUI.showToast("Tarefa atualizada com sucesso.");
    } else {
      TaskStore.createTask(payload);
      TaskUI.showToast("Tarefa criada com sucesso.");
    }

    closeModal();
    refresh();
  }

  function handleTaskListClick(event) {
    const target = event.target;
    const action = target.dataset.action;
    const id = target.dataset.id;
    const tag = target.dataset.tag;

    if (typeof tag !== "undefined") {
      state.filters.tag = tag;
      refresh();
      return;
    }

    if (!action || !id) {
      return;
    }

    if (action === "edit") {
      const task = TaskStore.getTaskById(id);

      if (task) {
        openModal(task);
      }

      return;
    }

    if (action === "delete") {
      openConfirm(id);
    }
  }

  function handleTaskListChange(event) {
    const target = event.target;

    if (target.dataset.action === "toggle" && target.dataset.id) {
      TaskStore.toggleTask(target.dataset.id);
      TaskUI.showToast("Status da tarefa atualizado.");
      refresh();
    }
  }

  function bindModalClose() {
    const modalButtons = document.querySelectorAll("[data-close-modal]");
    const confirmButtons = document.querySelectorAll("[data-close-confirm]");

    modalButtons.forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    confirmButtons.forEach(function (button) {
      button.addEventListener("click", closeConfirm);
    });
  }

  function bindFilters() {
    refs.searchInput.addEventListener("input", function (event) {
      state.filters.search = event.target.value;
      refresh();
    });

    refs.statusFilter.addEventListener("change", function (event) {
      state.filters.status = event.target.value;
      refresh();
    });

    refs.sortMode.addEventListener("change", function (event) {
      state.filters.sort = event.target.value;
      refresh();
    });

    refs.hashtagsPanel.addEventListener("click", function (event) {
      const tag = event.target.dataset.tag;

      if (typeof tag === "undefined") {
        return;
      }

      state.filters.tag = tag;
      refresh();
    });
  }

  async function syncNow() {
    try {
      showLoading("Sincronizando tarefas...");

      const localTasks = TaskStore.load();
      const mergedTasks = await TaskSync.syncTasks(localTasks);

      TaskStore.save(mergedTasks);
      TaskStore.saveLastSync(new Date().toISOString());

      refresh();
      updateLastSyncInfo();
      showSyncSuccess();
      TaskUI.showToast("Sincronização concluída.");
    } catch (error) {
      console.error("Erro no syncNow:", error);
      TaskUI.showToast("Erro ao sincronizar: " + error.message);
    } finally {
      hideLoading();
    }
  }

  async function initialSync() {
    try {
      showLoading("Carregando backup da planilha...");

      const remoteTasks = await TaskSync.fetchRemoteTasks();

      if (remoteTasks.length > 0 && TaskStore.load().length === 0) {
        TaskStore.save(remoteTasks);
        TaskStore.saveLastSync(new Date().toISOString());
      }

      refresh();
      updateLastSyncInfo();
    } catch (error) {
      console.error("Erro no initialSync:", error);
      refresh();
      updateLastSyncInfo();
    } finally {
      hideLoading();
    }
  }

  function bindEvents() {
    refs.newTaskBtn.addEventListener("click", function () {
      openModal();
    });

    if (refs.syncBtn) {
      refs.syncBtn.addEventListener("click", function () {
        syncNow();
      });
    }

    if (refs.taskRecurring) {
      refs.taskRecurring.addEventListener("change", updateRecurrenceVisibility);
    }

    refs.taskForm.addEventListener("submit", handleSubmit);
    refs.taskList.addEventListener("click", handleTaskListClick);
    refs.taskList.addEventListener("change", handleTaskListChange);

    refs.confirmDeleteBtn.addEventListener("click", function () {
      if (!state.pendingDeleteId) {
        return;
      }

      TaskStore.deleteTask(state.pendingDeleteId);
      TaskUI.showToast("Tarefa excluída.");
      closeConfirm();
      refresh();
    });

    bindModalClose();
    bindFilters();

    TaskCalendar.bindEvents(
      function (date, shouldRefresh) {
        if (date) {
          state.filters.date = date;
          TaskCalendar.setSelectedDate(date);
        }

        if (shouldRefresh !== false) {
          refresh();
        }
      },
      function () {
        state.filters.date = "";
        TaskCalendar.setSelectedDate("");
        refresh();
      }
    );
    const themeBtn = document.getElementById("themeToggleBtn");

if (themeBtn) {
  themeBtn.addEventListener("click", toggleTheme);
}
  }

  async function init() {
    applySavedTheme();
    hideLoading();
    bindEvents();
    refresh();
    updateLastSyncInfo();
    await initialSync();

    setInterval(function () {
      syncNow();
    }, 1000 * 60 * 5);
  }

  function applySavedTheme() {
  const saved = localStorage.getItem("theme");

  if (saved === "light") {
    document.documentElement.classList.add("light");
  }
  updateThemeIcon()
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle("light");

  localStorage.setItem("theme", isLight ? "light" : "dark");
  updateThemeIcon()
}

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  App.init();
});

function updateThemeIcon() {
  const btn = document.getElementById("themeToggleBtn");
  const isLight = document.documentElement.classList.contains("light");

  btn.textContent = isLight ? "🌙" : "☀️";
}