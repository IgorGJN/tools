const App = (function () {
  const AUTH_STORAGE_KEY = "tasks_tool_auth_v1";
  const VISIBILITY_STORAGE_KEY = "tasks_tool_visibility_v1";

  const state = {
    filters: {
      search: "",
      status: "all",
      sort: "smart",
      tag: "",
      date: "",
      visibility: localStorage.getItem(VISIBILITY_STORAGE_KEY) || "mine"
    },
    pendingDeleteId: null,
    auth: null,
    user: null
  };

  const refs = {
    newTaskBtn: document.getElementById("newTaskBtn"),
    syncBtn: document.getElementById("syncBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    userSessionInfo: document.getElementById("userSessionInfo"),
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
    taskEndDate: document.getElementById("taskEndDate"),
    taskEndTime: document.getElementById("taskEndTime"),
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
    hashtagsPanel: document.getElementById("hashtagsPanel"),
    visibilityFilter: document.getElementById("visibilityFilter"),

    authModal: document.getElementById("authModal"),
    authForm: document.getElementById("authForm"),
    authLoadingState: document.getElementById("authLoadingState"),
    authLoadingText: document.getElementById("authLoadingText"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authError: document.getElementById("authError"),
    appLoader: document.getElementById("appLoader"),
    appShell: document.getElementById("appShell"),
  };

  function getAuthStorage() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function saveAuthStorage(auth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }

  function clearAuthStorage() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

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

  function showAppLoader(text) {
  if (!refs.appLoader) return;

  const textEl = refs.appLoader.querySelector(".loader-text");
  if (textEl && text) {
    textEl.textContent = text;
  }

  refs.appLoader.classList.remove("hidden");
}

function hideAppLoader() {
  if (!refs.appLoader) return;

  refs.appLoader.classList.add("hidden");
}

function revealAppShell() {
  if (!refs.appShell) return;

  refs.appShell.classList.remove("app-shell-preload");
  refs.appShell.classList.add("app-shell-ready");
}

  function openAuthLoading(text) {
    refs.authModal.classList.remove("hidden");
    refs.authModal.setAttribute("aria-hidden", "false");
    refs.authLoadingState.classList.remove("hidden");
    refs.authForm.classList.add("hidden");
    refs.authLoadingText.textContent = text || "Validando sessão...";
    refs.authError.classList.add("hidden");
    refs.authError.textContent = "";
  }

  function openAuthForm(errorText) {
  refs.authModal.classList.remove("hidden");
  refs.authModal.setAttribute("aria-hidden", "false");
  refs.authLoadingState.classList.add("hidden");
  refs.authForm.classList.remove("hidden");

  revealAppShell();
  hideAppLoader();

  if (errorText) {
    refs.authError.textContent = errorText;
    refs.authError.classList.remove("hidden");
  } else {
    refs.authError.textContent = "";
    refs.authError.classList.add("hidden");
  }
}

  function closeAuthModal() {
    refs.authModal.classList.add("hidden");
    refs.authModal.setAttribute("aria-hidden", "true");
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

  function renderUserSessionInfo() {
    if (!refs.userSessionInfo) {
      return;
    }

    if (!state.user) {
      refs.userSessionInfo.classList.add("hidden");
      refs.userSessionInfo.textContent = "";
      return;
    }

    refs.userSessionInfo.textContent = "Conectado como " + state.user.name + " (@" + state.user.username + ")";
    refs.userSessionInfo.classList.remove("hidden");
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

  function getAccessibleTasks() {
    const tasks = getAllTasks();
    const username = state.user ? state.user.username : "";
    return TaskStore.getVisibleTasksForUser(tasks, username, state.filters.visibility);
  }

  function getCalendarTasks() {
    const accessible = getAccessibleTasks();
    return TaskStore.filterTasks(accessible, {
      search: state.filters.search,
      status: state.filters.status,
      tag: state.filters.tag,
      date: ""
    });
  }

  function getVisibleTasks() {
    const accessible = getAccessibleTasks();
    const filtered = TaskStore.filterTasks(accessible, state.filters);
    return TaskStore.sortTasks(filtered, state.filters.sort);
  }

  function applyVisibilityFilterUI() {
    const buttons = refs.visibilityFilter ? refs.visibilityFilter.querySelectorAll("[data-visibility]") : [];

    buttons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.visibility === state.filters.visibility);
    });
  }

  function refresh() {
    const accessibleTasks = getAccessibleTasks();
    const visibleTasks = getVisibleTasks();
    const calendarTasks = getCalendarTasks();

    TaskUI.renderSummary(TaskStore.buildSummary(accessibleTasks));
    TaskUI.renderHashtags(TaskStore.allHashtags(accessibleTasks), state.filters.tag);
    TaskUI.renderTasks(visibleTasks, state.user ? state.user.username : "");
    TaskUI.renderUpcoming(TaskStore.getUpcoming(accessibleTasks));
    TaskCalendar.render(calendarTasks);
    applyVisibilityFilterUI();
  }

  function openModal(task) {
    refs.taskForm.reset();
    refs.taskDate.value = TaskStore.todayISO();
    refs.taskTime.value = "";
    refs.taskEndDate.value = "";
    refs.taskEndTime.value = "";
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
      refs.taskEndDate.value = TaskUI.normalizeDate(task.endDate || "");
      refs.taskEndTime.value = TaskUI.normalizeTime(task.endTime || "");
      refs.taskHashtags.value = (task.hashtags || []).map(function (tag) {
        return "#" + tag;
      }).join(", ");

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

  function validateTaskPayload(payload) {
    if (!payload.title.trim()) {
      return "Informe um título para a tarefa.";
    }

    if (!payload.date) {
      return "Informe uma data de início para a tarefa.";
    }

    if (payload.endDate) {
      if (payload.endDate < payload.date) {
        return "A data de término não pode ser anterior à data de início.";
      }

      if (payload.endDate === payload.date && payload.endTime && payload.time && payload.endTime < payload.time) {
        return "O horário de término não pode ser anterior ao horário de início no mesmo dia.";
      }
    }

    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      title: refs.taskTitle.value,
      description: refs.taskDescription.value,
      date: refs.taskDate.value,
      time: refs.taskTime.value,
      endDate: refs.taskEndDate.value,
      endTime: refs.taskEndTime.value,
      hashtags: refs.taskHashtags.value,
      recurring: refs.taskRecurring.checked,
      recurrenceType: refs.taskRecurrenceType.value,
      recurrenceInterval: refs.taskRecurrenceInterval.value
    };

    const validationError = validateTaskPayload(payload);
    if (validationError) {
      TaskUI.showToast(validationError);
      return;
    }

    const existingId = refs.taskId.value;

    if (existingId) {
      const updated = TaskStore.updateTask(existingId, payload, state.user.username);
      if (!updated) {
        TaskUI.showToast("Você só pode editar suas próprias tarefas.");
        return;
      }
      TaskUI.showToast("Tarefa atualizada com sucesso.");
    } else {
      TaskStore.createTask(payload, state.user.username);
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

    const task = TaskStore.getTaskById(id);

    if (!task) {
      return;
    }

    if ((action === "edit" || action === "delete") && !TaskStore.canEditTask(task, state.user.username)) {
      TaskUI.showToast("Você só pode alterar suas próprias tarefas.");
      return;
    }

    if (action === "edit") {
      openModal(task);
      return;
    }

    if (action === "delete") {
      openConfirm(id);
    }
  }

  function handleTaskListChange(event) {
    const target = event.target;

    if (target.dataset.action === "toggle" && target.dataset.id) {
      const updated = TaskStore.toggleTask(target.dataset.id, state.user.username);
      if (!updated) {
        TaskUI.showToast("Você só pode concluir suas próprias tarefas.");
        refresh();
        return;
      }
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

    if (refs.visibilityFilter) {
      refs.visibilityFilter.addEventListener("click", function (event) {
        const button = event.target.closest("[data-visibility]");
        if (!button) {
          return;
        }

        state.filters.visibility = button.dataset.visibility;
        localStorage.setItem(VISIBILITY_STORAGE_KEY, state.filters.visibility);
        refresh();
      });
    }
  }

  async function syncNow(showSuccessToast) {
    if (!state.auth) {
      return;
    }

    try {
      showLoading("Sincronizando tarefas...");

      const localTasks = TaskStore.load();
      const result = await TaskSync.syncTasks(localTasks, state.auth);

      if (result.user) {
        state.user = result.user;
        renderUserSessionInfo();
      }

      TaskStore.setTasks(result.tasks);
      TaskStore.saveLastSync(new Date().toISOString());

      refresh();
      updateLastSyncInfo();
      showSyncSuccess();

      if (showSuccessToast !== false) {
        TaskUI.showToast("Sincronização concluída.");
      }
    } catch (error) {
      console.error("Erro no syncNow:", error);
      if (/sessão|login|acesso|senha|usuário/i.test(String(error.message || ""))) {
        forceLogout(error.message || "Sessão inválida. Faça login novamente.");
        return;
      }
      TaskUI.showToast("Erro ao sincronizar: " + error.message);
    } finally {
      hideLoading();
    }
  }

  async function initialSync() {
    try {
      showLoading("Carregando tarefas...");
      const localTasks = TaskStore.load();
      const result = localTasks.length > 0
        ? await TaskSync.syncTasks(localTasks, state.auth)
        : await TaskSync.fetchRemoteTasks(state.auth);

      if (result.user) {
        state.user = result.user;
        renderUserSessionInfo();
      }

      TaskStore.setTasks(result.tasks);
      TaskStore.saveLastSync(new Date().toISOString());
      refresh();
      updateLastSyncInfo();
    } catch (error) {
      console.error("Erro no initialSync:", error);
      if (/sessão|login|acesso|senha|usuário/i.test(String(error.message || ""))) {
        forceLogout(error.message || "Sessão inválida. Faça login novamente.");
        return;
      }
      refresh();
      updateLastSyncInfo();
      TaskUI.showToast("Erro ao carregar tarefas: " + error.message);
    } finally {
      hideLoading();
    }
  }

  function bindEvents() {
    refs.newTaskBtn.addEventListener("click", function () {
      openModal();
    });

    refs.syncBtn.addEventListener("click", function () {
      syncNow(true);
    });

    refs.logoutBtn.addEventListener("click", function () {
      forceLogout();
    });

    if (refs.taskRecurring) {
      refs.taskRecurring.addEventListener("change", updateRecurrenceVisibility);
    }

    refs.taskForm.addEventListener("submit", handleSubmit);
    refs.taskList.addEventListener("click", handleTaskListClick);
    refs.taskList.addEventListener("change", handleTaskListChange);
    refs.authForm.addEventListener("submit", handleAuthSubmit);

    refs.confirmDeleteBtn.addEventListener("click", function () {
      if (!state.pendingDeleteId) {
        return;
      }

      const deleted = TaskStore.deleteTask(state.pendingDeleteId, state.user.username);
      if (!deleted) {
        TaskUI.showToast("Você só pode excluir suas próprias tarefas.");
        closeConfirm();
        refresh();
        return;
      }

      TaskUI.showToast("Tarefa excluída.");
      closeConfirm();
      refresh();
    });

    bindModalClose();
    bindFilters();

    TaskCalendar.bindEvents(
      function (date) {
        state.filters.date = date || "";
        TaskCalendar.setSelectedDate(state.filters.date);
        refresh();
      },
      function () {
        state.filters.date = "";
        TaskCalendar.setSelectedDate("");
        refresh();
      },
      function () {
        refresh();
      }
    );

    const themeBtn = document.getElementById("themeToggleBtn");

    if (themeBtn) {
      themeBtn.addEventListener("click", toggleTheme);
    }
  }

  function applySavedTheme() {
    const saved = localStorage.getItem("theme");

    if (saved === "light") {
      document.documentElement.classList.add("light");
    }

    updateThemeIcon();
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    updateThemeIcon();
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    const username = String(refs.authUsername.value || "").trim();
    const password = String(refs.authPassword.value || "").trim();

    if (!username || !password) {
      openAuthForm("Informe usuário e senha.");
      return;
    }

    try {
  openAuthLoading("Entrando...");
  const response = await TaskSync.login(username, password);

  state.auth = { username: username, password: password };
  state.user = response.user || null;

  saveAuthStorage(state.auth);

  closeAuthModal();
  renderUserSessionInfo();

  await initialSync();

  // libera o app com animação
  revealAppShell();
  hideAppLoader();

  if (window.PopupNews && typeof PopupNews.init === "function") {
    PopupNews.init();
  }

} catch (error) {
  console.error("Erro no login:", error);

  // mostra o formulário e tira o loader inicial
  revealAppShell();
  hideAppLoader();

  openAuthForm(error.message || "Falha ao entrar.");
}
  }

  async function bootstrapAuth() {
  const savedAuth = getAuthStorage();

  if (!savedAuth || !savedAuth.username || !savedAuth.password) {
    openAuthForm();
    return;
  }

  try {
    openAuthLoading("Validando sessão salva...");
    const response = await TaskSync.validateSession(savedAuth);

    state.auth = savedAuth;
    state.user = response.user || null;

    closeAuthModal();
    renderUserSessionInfo();

    await initialSync();

    revealAppShell();
    hideAppLoader();

    if (typeof PopupNews !== "undefined" && typeof PopupNews.init === "function") {
  setTimeout(function () {
    PopupNews.init();
  }, 100);
}

  } catch (error) {
    console.error("Erro ao validar sessão:", error);

    clearAuthStorage();
    state.auth = null;
    state.user = null;

    renderUserSessionInfo();
    openAuthForm(error.message || "Sua sessão expirou. Entre novamente.");
  }
}

  function forceLogout(message) {
  clearAuthStorage();
  state.auth = null;
  state.user = null;
  TaskStore.setTasks([]);
  renderUserSessionInfo();
  refresh();
  openAuthForm(message || "");
}

  async function init() {
    applySavedTheme();
    showAppLoader("Acessando agenda...");
    hideLoading();
    bindEvents();
    refresh();
    updateLastSyncInfo();
    await bootstrapAuth();

    setInterval(function () {
      if (state.auth) {
        syncNow(false);
      }
    }, 1000 * 60 * 5);
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

  if (btn) {
    btn.textContent = isLight ? "🌙" : "☀️";
  }
}
