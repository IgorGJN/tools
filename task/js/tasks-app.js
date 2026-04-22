const App = (function () {
  const AUTH_STORAGE_KEY = "tasks_tool_auth_v1";
  const VISIBILITY_STORAGE_KEY = "tasks_tool_visibility_v1";
  const OFFLINE_SESSION_MAX_HOURS = 48;
  const OFFLINE_SESSION_MAX_MS = OFFLINE_SESSION_MAX_HOURS * 60 * 60 * 1000;

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
    user: null,
    activeScreen: "home",
    selectedCalendarDate: "",
    isSyncing: false,
    overdueExpanded: false,
    upcomingExpanded: false,
    searchOpen: false,
    hasBootedOnce: false
  };

  const refs = {
    appShell: document.getElementById("appShell"),
    appLoader: document.getElementById("appLoader"),

    screenHome: document.getElementById("screen-home"),
    screenAll: document.getElementById("screen-all"),
    screenCalendar: document.getElementById("screen-calendar"),
    screenSettings: document.getElementById("screen-settings"),

    screenHomeBtn: document.getElementById("screenHomeBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    searchToggleBtn: document.getElementById("searchToggleBtn"),
    closeSearchBtn: document.getElementById("closeSearchBtn"),

    fabAll: document.getElementById("fabAll"),
    fabCalendar: document.getElementById("fabCalendar"),
    newTaskBtn: document.getElementById("newTaskBtn"),

    searchPanel: document.getElementById("searchPanel"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    sortMode: document.getElementById("sortMode"),
    visibilityFilter: document.getElementById("visibilityFilter"),
    hashtagsPanel: document.getElementById("hashtagsPanel"),

    toggleOverdueBtn: document.getElementById("toggleOverdueBtn"),
    toggleUpcomingBtn: document.getElementById("toggleUpcomingBtn"),
    overdueList: document.getElementById("overdueList"),
    upcomingList: document.getElementById("upcomingList"),

    dayTasksPanel: document.getElementById("dayTasksPanel"),

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
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingText: document.getElementById("loadingText"),
    lastSyncInfo: document.getElementById("lastSyncInfo"),
    userSessionInfo: document.getElementById("userSessionInfo"),

    authModal: document.getElementById("authModal"),
    authForm: document.getElementById("authForm"),
    authLoadingState: document.getElementById("authLoadingState"),
    authLoadingText: document.getElementById("authLoadingText"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authError: document.getElementById("authError"),

    syncBtn: document.getElementById("syncBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    enableNotificationsBtn: document.getElementById("enableNotificationsBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn")
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

  function buildStoredAuth(auth, user) {
    return {
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim(),
      user: user || null,
      lastValidatedAt: new Date().toISOString()
    };
  }

  function markAuthValidated(user) {
    if (!state.auth) {
      return;
    }

    const stored = buildStoredAuth(state.auth, user || state.user || null);
    saveAuthStorage(stored);
    state.auth = stored;
  }

  function isOfflineSessionStillValid(savedAuth) {
    if (!savedAuth || !savedAuth.lastValidatedAt) {
      return false;
    }

    const validatedAt = new Date(savedAuth.lastValidatedAt).getTime();
    if (!validatedAt || Number.isNaN(validatedAt)) {
      return false;
    }

    return Date.now() - validatedAt <= OFFLINE_SESSION_MAX_MS;
  }

  function canEnterOfflineMode(savedAuth) {
    const localTasks = TaskStore.load();

    return (
      !!savedAuth &&
      !!savedAuth.username &&
      !!savedAuth.password &&
      isOfflineSessionStillValid(savedAuth) &&
      localTasks.length > 0
    );
  }

  function isNetworkError(error) {
    const message = String((error && error.message) || "").toLowerCase();

    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed") ||
      message.includes("internet disconnected") ||
      message.includes("err_internet_disconnected")
    );
  }

  function revealAppShell() {
    if (!refs.appShell) return;
    refs.appShell.classList.remove("app-shell-preload");
    refs.appShell.classList.add("app-shell-ready");
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

  function showLoading(text) {
    if (!refs.loadingOverlay || !refs.loadingText) {
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

  function getSyncMeta() {
    if (window.TaskSync && typeof TaskSync.getSyncMeta === "function") {
      return TaskSync.getSyncMeta();
    }

    return {
      lastAttemptAt: "",
      lastSuccessAt: "",
      lastError: "",
      pendingLocalChanges: false
    };
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

  function updateLastSyncInfo(prefixText) {
    if (!refs.lastSyncInfo) {
      return;
    }

    if (prefixText) {
      refs.lastSyncInfo.textContent = prefixText;
      return;
    }

    const syncMeta = getSyncMeta();
    const lastSync = TaskStore.getLastSync();

    if (state.isSyncing) {
      refs.lastSyncInfo.textContent = "Sincronizando em segundo plano...";
      return;
    }

    if (!navigator.onLine) {
      if (syncMeta.pendingLocalChanges) {
        refs.lastSyncInfo.textContent =
          "Offline • alterações salvas localmente e pendentes de sincronização";
        return;
      }

      refs.lastSyncInfo.textContent = "Offline • exibindo dados salvos no dispositivo";
      return;
    }

    if (syncMeta.pendingLocalChanges) {
      refs.lastSyncInfo.textContent =
        formatLastSync(lastSync) + " • alterações locais pendentes";
      return;
    }

    refs.lastSyncInfo.textContent = formatLastSync(lastSync);
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

    refs.userSessionInfo.textContent =
      "Conectado como " + state.user.name + " (@" + state.user.username + ")";
    refs.userSessionInfo.classList.remove("hidden");
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
    }, 1800);
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

  function showScreen(screenName) {
    state.activeScreen = screenName;

    const map = {
      home: refs.screenHome,
      all: refs.screenAll,
      calendar: refs.screenCalendar,
      settings: refs.screenSettings
    };

    Object.keys(map).forEach(function (key) {
      if (!map[key]) return;
      map[key].classList.toggle("hidden", key !== screenName);
      map[key].classList.toggle("screen-active", key === screenName);
    });
  }

  function toggleSearch(open) {
    state.searchOpen = typeof open === "boolean" ? open : !state.searchOpen;

    if (!refs.searchPanel) {
      return;
    }

    refs.searchPanel.classList.toggle("hidden", !state.searchOpen);

    if (state.searchOpen && refs.searchInput) {
      setTimeout(function () {
        refs.searchInput.focus();
      }, 40);
    }
  }

  function toggleOverdue(expand) {
    state.overdueExpanded =
      typeof expand === "boolean" ? expand : !state.overdueExpanded;

    if (refs.overdueList) {
      refs.overdueList.classList.toggle("hidden", !state.overdueExpanded);
    }
  }

  function toggleUpcoming(expand) {
    state.upcomingExpanded =
      typeof expand === "boolean" ? expand : !state.upcomingExpanded;

    if (refs.upcomingList) {
      refs.upcomingList.classList.toggle("hidden", !state.upcomingExpanded);
    }
  }

  function applyVisibilityFilterUI() {
    const buttons = refs.visibilityFilter
      ? refs.visibilityFilter.querySelectorAll("[data-visibility]")
      : [];

    buttons.forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.visibility === state.filters.visibility
      );
    });
  }

  function applyFilterInputsUI() {
    if (refs.statusFilter) {
      refs.statusFilter.value = state.filters.status;
    }

    if (refs.sortMode) {
      refs.sortMode.value = state.filters.sort;
    }

    if (refs.searchInput) {
      refs.searchInput.value = state.filters.search;
    }
  }

  function getAllTasks() {
    return TaskStore.load();
  }

  function getHomeTasksBase() {
  const tasks = getAllTasks();
  const username = state.user ? state.user.username : "";

  return TaskStore.getVisibleTasksForUser(tasks, username, "all");
}

  function getAccessibleTasks() {
    const tasks = getAllTasks();
    const username = state.user ? state.user.username : "";
    return TaskStore.getVisibleTasksForUser(
      tasks,
      username,
      state.filters.visibility
    );
  }

  function getReminderTasks() {
    return getAccessibleTasks().filter(function (task) {
      return !task.deleted && !task.completed;
    });
  }

  async function processReminders() {
    if (!window.TaskNotifications) {
      return;
    }

    try {
      await TaskNotifications.processTasks(getReminderTasks());
    } catch (error) {
      console.error("Erro ao processar lembretes:", error);
    }
  }

  function baseFilteredTasks(tasks) {
    return TaskStore.filterTasks(tasks, {
      search: state.filters.search,
      status: "all",
      tag: state.filters.tag,
      date: ""
    });
  }

  function sortTodayTasks(tasks) {
    return tasks.slice().sort(function (a, b) {
      const aCompleted = a.completed ? 1 : 0;
      const bCompleted = b.completed ? 1 : 0;

      if (aCompleted !== bCompleted) {
        return aCompleted - bCompleted;
      }

      const timeA = String(a.time || "23:59");
      const timeB = String(b.time || "23:59");

      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function getTodayTasks() {
  const today = TaskStore.todayISO();
  const homeTasks = getHomeTasksBase();

  const filtered = homeTasks.filter(function (task) {
    return !task.deleted && TaskStore.taskIntersectsDate(task, today);
  });

  return sortTodayTasks(filtered);
}

  function getOverdueTasks() {
  const homeTasks = getHomeTasksBase();

  return TaskStore.sortTasks(
    homeTasks.filter(function (task) {
      return !task.deleted && TaskStore.getStatus(task) === "overdue";
    }),
    "date-asc"
  );
}

  function getUpcomingTasks() {
  const homeTasks = getHomeTasksBase();

  return TaskStore.getUpcoming(
    homeTasks.filter(function (task) {
      return !task.deleted;
    }),
    5
  );
}

  function getAllScreenTasks(accessibleTasks) {
    const filtered = TaskStore.filterTasks(accessibleTasks, {
      search: state.filters.search,
      status: state.filters.status,
      sort: state.filters.sort,
      tag: state.filters.tag,
      date: "",
      visibility: state.filters.visibility
    });

    return TaskStore.sortTasks(filtered, state.filters.sort);
  }

  function getCalendarTasks(accessibleTasks) {
    return TaskStore.filterTasks(accessibleTasks, {
      search: state.filters.search,
      status: state.filters.status,
      tag: state.filters.tag,
      date: ""
    });
  }

  function getSelectedDayTasks(calendarTasks) {
    if (!state.selectedCalendarDate) {
      return [];
    }

    const filtered = calendarTasks.filter(function (task) {
      return TaskStore.taskIntersectsDate(task, state.selectedCalendarDate);
    });

    return TaskStore.sortTasks(filtered, "date-asc");
  }

  function refresh() {
    const accessibleTasks = getAccessibleTasks();
    const todayTasks = getTodayTasks();
    const overdueTasks = getOverdueTasks();
    const upcomingTasks = getUpcomingTasks();
    const allTasks = getAllScreenTasks(accessibleTasks);
    const calendarTasks = getCalendarTasks(accessibleTasks);
    const dayTasks = getSelectedDayTasks(calendarTasks);

    TaskUI.renderSummary(TaskStore.buildSummary(accessibleTasks));
    TaskUI.renderHashtags(TaskStore.allHashtags(accessibleTasks), state.filters.tag);
    TaskUI.renderTasks(todayTasks, state.user ? state.user.username : "");
    TaskUI.renderOverdue(overdueTasks, state.user ? state.user.username : "");
    TaskUI.renderUpcoming(upcomingTasks);
    TaskUI.renderGroupedTasks(allTasks, state.user ? state.user.username : "");

    TaskCalendar.setSelectedDate(state.selectedCalendarDate || "");
    TaskCalendar.render(calendarTasks);

    if (state.selectedCalendarDate) {
      TaskUI.renderCalendarDayTasks(
        dayTasks,
        state.user ? state.user.username : "",
        TaskUI.formatSingleDate(state.selectedCalendarDate, "")
      );
    } else {
      TaskUI.hideCalendarDayTasks();
    }

    applyVisibilityFilterUI();
    applyFilterInputsUI();
    toggleOverdue(state.overdueExpanded);
    toggleUpcoming(state.upcomingExpanded);
    renderUserSessionInfo();
    updateLastSyncInfo();
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

      if (
        payload.endDate === payload.date &&
        payload.endTime &&
        payload.time &&
        payload.endTime < payload.time
      ) {
        return "O horário de término não pode ser anterior ao horário de início no mesmo dia.";
      }
    }

    return "";
  }

  function scheduleBackgroundSync() {
    if (navigator.onLine && state.auth) {
      syncNow({ manual: false, silentSuccess: true });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!state.user || !state.user.username) {
      TaskUI.showToast("Entre na sua conta para criar ou editar tarefas.");
      return;
    }

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
      const updated = TaskStore.updateTask(
        existingId,
        payload,
        state.user.username
      );

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
    processReminders();
    scheduleBackgroundSync();
  }

  function handleGlobalClick(event) {
    const tag = event.target.dataset.tag;
    const action = event.target.dataset.action;
    const id = event.target.dataset.id;

    if (typeof tag !== "undefined") {
      state.filters.tag = tag;
      showScreen("all");
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

    if (
      (action === "edit" || action === "delete") &&
      !TaskStore.canEditTask(task, state.user ? state.user.username : "")
    ) {
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

  function handleGlobalChange(event) {
    const target = event.target;

    if (target.dataset.action === "toggle" && target.dataset.id) {
      const updated = TaskStore.toggleTask(
        target.dataset.id,
        state.user ? state.user.username : ""
      );

      if (!updated) {
        TaskUI.showToast("Você só pode concluir suas próprias tarefas.");
        refresh();
        return;
      }

      TaskUI.showToast("Status da tarefa atualizado.");
      refresh();
      processReminders();
      scheduleBackgroundSync();
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

  function bindNavigation() {
    if (refs.screenHomeBtn) {
      refs.screenHomeBtn.addEventListener("click", function () {
        showScreen("home");
      });
    }

    if (refs.settingsBtn) {
      refs.settingsBtn.addEventListener("click", function () {
        showScreen("settings");
      });
    }

    if (refs.fabAll) {
      refs.fabAll.addEventListener("click", function () {
        showScreen("all");
      });
    }

    if (refs.fabCalendar) {
      refs.fabCalendar.addEventListener("click", function () {
        showScreen("calendar");
      });
    }

    if (refs.searchToggleBtn) {
      refs.searchToggleBtn.addEventListener("click", function () {
        toggleSearch(true);
      });
    }

    if (refs.closeSearchBtn) {
      refs.closeSearchBtn.addEventListener("click", function () {
        toggleSearch(false);
      });
    }

    if (refs.toggleOverdueBtn) {
      refs.toggleOverdueBtn.addEventListener("click", function () {
        toggleOverdue();
      });
    }

    if (refs.toggleUpcomingBtn) {
      refs.toggleUpcomingBtn.addEventListener("click", function () {
        toggleUpcoming();
      });
    }
  }

  function bindFilters() {
    if (refs.searchInput) {
      refs.searchInput.addEventListener("input", function (event) {
        state.filters.search = event.target.value;
        refresh();
      });
    }

    if (refs.statusFilter) {
      refs.statusFilter.addEventListener("change", function (event) {
        state.filters.status = event.target.value;
        refresh();
      });
    }

    if (refs.sortMode) {
      refs.sortMode.addEventListener("change", function (event) {
        state.filters.sort = event.target.value;
        refresh();
      });
    }

    if (refs.hashtagsPanel) {
      refs.hashtagsPanel.addEventListener("click", function (event) {
        const tag = event.target.dataset.tag;
        if (typeof tag === "undefined") {
          return;
        }

        state.filters.tag = tag;
        refresh();
      });
    }

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

  async function syncNow(options) {
    const config = {
      manual: false,
      silentSuccess: false,
      ...options
    };

    if (!state.auth || state.isSyncing) {
      return;
    }

    state.isSyncing = true;
    updateLastSyncInfo();

    try {
      if (config.manual) {
        showLoading("Sincronizando tarefas...");
      } else {
        updateLastSyncInfo("Sincronizando em segundo plano...");
      }

      const localTasks = TaskStore.load();
      const result = await TaskSync.syncTasks(localTasks, state.auth);

      if (result.user) {
        state.user = result.user;
        renderUserSessionInfo();
      }

      markAuthValidated(result.user || state.user);

      TaskStore.setTasks(result.tasks, { markPending: false });
      TaskStore.saveLastSync(new Date().toISOString());

      refresh();

      if (config.manual) {
        showSyncSuccess();
      }

      await processReminders();

      if (!config.silentSuccess) {
        TaskUI.showToast("Sincronização concluída.");
      }
    } catch (error) {
      console.error("Erro no syncNow:", error);

      if (isNetworkError(error) || !navigator.onLine) {
        refresh();
        TaskUI.showToast(
          "Sem internet. Suas alterações continuam salvas no dispositivo."
        );
        return;
      }

      if (/sessão|login|acesso|senha|usuário/i.test(String(error.message || ""))) {
        forceLogout(error.message || "Sessão inválida. Faça login novamente.");
        return;
      }

      refresh();
      TaskUI.showToast("Erro ao sincronizar: " + error.message);
    } finally {
      state.isSyncing = false;
      hideLoading();
      updateLastSyncInfo();
    }
  }

  async function initialSync() {
    if (!state.auth) {
      return;
    }

    try {
      updateLastSyncInfo("Atualizando dados...");
      const localTasks = TaskStore.load();

      const result =
        localTasks.length > 0
          ? await TaskSync.syncTasks(localTasks, state.auth)
          : await TaskSync.fetchRemoteTasks(state.auth);

      if (result.user) {
        state.user = result.user;
        renderUserSessionInfo();
      }

      markAuthValidated(result.user || state.user);

      TaskStore.setTasks(result.tasks, { markPending: false });
      TaskStore.saveLastSync(new Date().toISOString());
      refresh();
      updateLastSyncInfo();

      await processReminders();
    } catch (error) {
      console.error("Erro no initialSync:", error);

      if (isNetworkError(error) || !navigator.onLine) {
        refresh();
        updateLastSyncInfo();
        TaskUI.showToast("Sem internet. Exibindo os dados salvos neste dispositivo.");
        return;
      }

      if (/sessão|login|acesso|senha|usuário/i.test(String(error.message || ""))) {
        forceLogout(error.message || "Sessão inválida. Faça login novamente.");
        return;
      }

      refresh();
      updateLastSyncInfo();
      TaskUI.showToast("Erro ao atualizar tarefas: " + error.message);
    }
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

      state.auth = buildStoredAuth(
        { username: username, password: password },
        response.user || null
      );
      state.user = response.user || null;

      saveAuthStorage(state.auth);
      closeAuthModal();
      renderUserSessionInfo();
      refresh();

      await initialSync();

      if (window.PopupNews && typeof PopupNews.init === "function") {
        PopupNews.init();
      }
    } catch (error) {
      console.error("Erro no login:", error);
      openAuthForm(error.message || "Falha ao entrar.");
    }
  }

  async function bootstrapAuth() {
    const savedAuth = getAuthStorage();

    if (!savedAuth || !savedAuth.username || !savedAuth.password) {
      openAuthForm();
      return;
    }

    state.auth = savedAuth;
    state.user =
      savedAuth.user || {
        username: savedAuth.username,
        name: savedAuth.username
      };

    renderUserSessionInfo();
    refresh();

    if (!navigator.onLine) {
      if (canEnterOfflineMode(savedAuth)) {
        TaskUI.showToast(
          "Modo offline ativo. Você pode usar o app por até 48 horas sem nova validação."
        );
        return;
      }

      openAuthForm(
        "Sem internet. Entre online pelo menos uma vez a cada 48 horas para continuar usando offline."
      );
      return;
    }

    try {
      updateLastSyncInfo("Validando sessão...");
      const response = await TaskSync.validateSession(savedAuth);

      state.auth = buildStoredAuth(
        savedAuth,
        response.user || savedAuth.user || null
      );
      state.user = response.user || savedAuth.user || null;

      saveAuthStorage(state.auth);
      renderUserSessionInfo();

      await initialSync();

      if (typeof PopupNews !== "undefined" && typeof PopupNews.init === "function") {
        setTimeout(function () {
          PopupNews.init();
        }, 120);
      }
    } catch (error) {
      console.error("Erro ao validar sessão:", error);

      if ((isNetworkError(error) || !navigator.onLine) && canEnterOfflineMode(savedAuth)) {
        TaskUI.showToast(
          "Sem conexão. Continuando com os dados salvos no dispositivo."
        );
        refresh();
        return;
      }

      if (/sessão|login|acesso|senha|usuário/i.test(String(error.message || ""))) {
        clearAuthStorage();
        state.auth = null;
        state.user = null;
        renderUserSessionInfo();
        refresh();
        openAuthForm(error.message || "Sua sessão expirou. Entre novamente.");
        return;
      }

      if (canEnterOfflineMode(savedAuth)) {
        TaskUI.showToast(
          "Não foi possível validar agora. Continuando com os dados locais."
        );
        refresh();
        return;
      }

      openAuthForm("Não foi possível validar a sessão agora. Tente novamente com internet.");
    }
  }

  function forceLogout(message) {
    clearAuthStorage();
    state.auth = null;
    state.user = null;
    renderUserSessionInfo();
    refresh();
    openAuthForm(message || "");
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

  function bindEvents() {
    bindNavigation();
    bindFilters();
    bindModalClose();

    if (refs.newTaskBtn) {
      refs.newTaskBtn.addEventListener("click", function () {
        openModal();
      });
    }

    if (refs.syncBtn) {
      refs.syncBtn.addEventListener("click", function () {
        syncNow({
          manual: true,
          silentSuccess: false
        });
      });
    }

    if (refs.logoutBtn) {
      refs.logoutBtn.addEventListener("click", function () {
        forceLogout();
      });
    }

    if (refs.themeToggleBtn) {
      refs.themeToggleBtn.addEventListener("click", toggleTheme);
    }

    if (refs.enableNotificationsBtn) {
      refs.enableNotificationsBtn.addEventListener("click", async function () {
        if (!window.TaskNotifications) {
          TaskUI.showToast("Módulo de notificações não carregado.");
          return;
        }

        const permission = await TaskNotifications.requestPermission();

        if (permission === "granted") {
          await TaskNotifications.showTestNotification();
          TaskUI.showToast("Notificações ativadas com sucesso.");
          return;
        }

        if (permission === "denied") {
          TaskUI.showToast("Permissão de notificações negada.");
          return;
        }

        TaskUI.showToast("Notificações não suportadas.");
      });
    }

    if (refs.taskRecurring) {
      refs.taskRecurring.addEventListener("change", updateRecurrenceVisibility);
    }

    if (refs.taskForm) {
      refs.taskForm.addEventListener("submit", handleSubmit);
    }

    if (refs.authForm) {
      refs.authForm.addEventListener("submit", handleAuthSubmit);
    }

    if (refs.confirmDeleteBtn) {
      refs.confirmDeleteBtn.addEventListener("click", function () {
        if (!state.pendingDeleteId) {
          return;
        }

        const deleted = TaskStore.deleteTask(
          state.pendingDeleteId,
          state.user ? state.user.username : ""
        );

        if (!deleted) {
          TaskUI.showToast("Você só pode excluir suas próprias tarefas.");
          closeConfirm();
          refresh();
          return;
        }

        TaskUI.showToast("Tarefa excluída.");
        closeConfirm();
        refresh();
        scheduleBackgroundSync();
      });
    }

    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("change", handleGlobalChange);

    window.addEventListener("online", function () {
      updateLastSyncInfo();
      if (state.auth) {
        TaskUI.showToast("Conexão restabelecida. Sincronizando alterações.");
        syncNow({ manual: false, silentSuccess: true });
      }
    });

    window.addEventListener("offline", function () {
      updateLastSyncInfo();
      TaskUI.showToast("Você está offline. O app continuará usando os dados locais.");
    });

    TaskCalendar.bindEvents(
      function (date) {
        state.selectedCalendarDate = date || "";
        showScreen("calendar");
        refresh();
      },
      function () {
        state.selectedCalendarDate = "";
        refresh();
      },
      function () {
        refresh();
      }
    );
  }

  async function init() {
    applySavedTheme();
    showAppLoader("Acessando agenda...");
    hideLoading();

    if (window.TaskNotifications) {
      await TaskNotifications.registerServiceWorker();
    }

    const savedAuth = getAuthStorage();
    if (savedAuth && savedAuth.username) {
      state.auth = savedAuth;
      state.user =
        savedAuth.user || {
          username: savedAuth.username,
          name: savedAuth.username
        };
    }

    bindEvents();
    refresh();
    revealAppShell();
    hideAppLoader();

    await bootstrapAuth();

    state.hasBootedOnce = true;

    setInterval(function () {
      if (state.auth && navigator.onLine) {
        const syncMeta = getSyncMeta();
        if (syncMeta.pendingLocalChanges || Date.now() % 2 === 0) {
          syncNow({ manual: false, silentSuccess: true });
        }
      }
    }, 1000 * 60 * 5);

    setInterval(function () {
      if (
        state.auth &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        processReminders();
      }
    }, 1000 * 60);
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