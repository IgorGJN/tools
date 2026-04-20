const App = (function () {
  const state = {
    filters: {
      search: "",
      status: "all",
      sort: "smart",
      tag: ""
    },
    pendingDeleteId: null
  };

  const refs = {
    newTaskBtn: document.getElementById("newTaskBtn"),
    syncBtn: document.getElementById("syncBtn"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingText: document.getElementById("loadingText"),

    taskModal: document.getElementById("taskModal"),
    confirmModal: document.getElementById("confirmModal"),
    taskForm: document.getElementById("taskForm"),
    taskId: document.getElementById("taskId"),
    taskTitle: document.getElementById("taskTitle"),
    taskDescription: document.getElementById("taskDescription"),
    taskDate: document.getElementById("taskDate"),
    taskTime: document.getElementById("taskTime"),
    taskHashtags: document.getElementById("taskHashtags"),
    modalTitle: document.getElementById("modalTitle"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    sortMode: document.getElementById("sortMode"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    taskList: document.getElementById("taskList"),
    hashtagsPanel: document.getElementById("hashtagsPanel")
  };

  function showLoading(text) {
    refs.loadingText.textContent = text || "Carregando...";
    refs.loadingOverlay.classList.remove("hidden");
    refs.loadingOverlay.setAttribute("aria-hidden", "false");
  }

  function hideLoading() {
    refs.loadingOverlay.classList.add("hidden");
    refs.loadingOverlay.setAttribute("aria-hidden", "true");
  }

  function getAllTasks() {
    return TaskStore.load();
  }

  function getVisibleTasks() {
    const tasks = getAllTasks();
    const filtered = TaskStore.filterTasks(tasks, state.filters);
    return TaskStore.sortTasks(filtered, state.filters.sort);
  }

  function refresh() {
    const allTasks = getAllTasks();
    const visibleTasks = getVisibleTasks();

    TaskUI.renderSummary(TaskStore.buildSummary(allTasks));
    TaskUI.renderHashtags(TaskStore.allHashtags(allTasks), state.filters.tag);
    TaskUI.renderTasks(visibleTasks);
    TaskUI.renderUpcoming(TaskStore.getUpcoming(allTasks));
  }

  function openModal(task) {
    refs.taskForm.reset();
    refs.taskDate.value = TaskStore.todayISO();
    refs.taskId.value = "";
    refs.modalTitle.textContent = "Nova tarefa";

    if (task) {
      refs.modalTitle.textContent = "Editar tarefa";
      refs.taskId.value = task.id;
      refs.taskTitle.value = task.title || "";
      refs.taskDescription.value = task.description || "";
      refs.taskDate.value = task.date || "";
      refs.taskTime.value = task.time || "";
      refs.taskHashtags.value = (task.hashtags || [])
        .map(function (tag) {
          return "#" + tag;
        })
        .join(", ");
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
      hashtags: refs.taskHashtags.value
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
    console.log("Tarefas locais antes do sync:", localTasks);

    const mergedTasks = await TaskSync.syncTasks(localTasks);
    console.log("Tarefas retornadas da API:", mergedTasks);

    TaskStore.save(mergedTasks);
    refresh();
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
    console.log("Tarefas remotas no carregamento inicial:", remoteTasks);

    if (remoteTasks.length > 0 && TaskStore.load().length === 0) {
      TaskStore.save(remoteTasks);
    }

    refresh();
  } catch (error) {
    console.error("Erro no initialSync:", error);
    TaskUI.showToast("Erro ao carregar backup: " + error.message);
    refresh();
  } finally {
    hideLoading();
  }
}

  function bindEvents() {
    refs.newTaskBtn.addEventListener("click", function () {
      openModal();
    });

    refs.syncBtn.addEventListener("click", function () {
      syncNow();
    });

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
  }

  async function init() {
  bindEvents();
  refresh();
  await syncNow();
}

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  App.init();
});