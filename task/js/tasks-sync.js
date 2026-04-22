const TaskSync = (function () {
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxV6lPXjSzkjU9S_bXQ_RKHpwQLaHdO2Rn2IB0I7f6d_9nHQa01XALpkedxopOzqsmM1A/exec";

  const META_STORAGE_KEY = "tasks_sync_meta_v1";

  function getSyncMeta() {
    try {
      const saved = JSON.parse(localStorage.getItem(META_STORAGE_KEY) || "{}");
      return {
        lastAttemptAt: saved.lastAttemptAt || "",
        lastSuccessAt: saved.lastSuccessAt || "",
        lastError: saved.lastError || "",
        pendingLocalChanges:
          saved.pendingLocalChanges === true || saved.pendingLocalChanges === "true"
      };
    } catch (error) {
      return {
        lastAttemptAt: "",
        lastSuccessAt: "",
        lastError: "",
        pendingLocalChanges: false
      };
    }
  }

  function saveSyncMeta(nextMeta) {
    const current = getSyncMeta();
    const merged = {
      ...current,
      ...nextMeta
    };
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function markPendingLocalChanges(value) {
    return saveSyncMeta({
      pendingLocalChanges: value === true
    });
  }

  function normalizeRemoteTask(task) {
    return TaskStore.normalizeTask({
      id: task.id,
      title: task.title,
      description: task.description,
      date: task.date,
      time: task.time,
      endDate: task.endDate,
      endTime: task.endTime,
      hashtags: String(task.hashtags || "")
        .split(",")
        .map(function (tag) {
          return tag.trim().replace(/^#+/, "").toLowerCase();
        })
        .filter(function (tag) {
          return tag.length > 0;
        }),
      completed: task.completed === true || String(task.completed).toLowerCase() === "true",
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deleted: task.deleted === true || String(task.deleted).toLowerCase() === "true",
      deletedAt: task.deletedAt || "",
      recurring: task.recurring === true || String(task.recurring).toLowerCase() === "true",
      recurrenceType: task.recurrenceType || "",
      recurrenceInterval: Number(task.recurrenceInterval || 1),
      parentTaskId: task.parentTaskId || "",
      owner: task.owner || ""
    });
  }

  function prepareLocalTask(task) {
    const normalized = TaskStore.normalizeTask(task);

    return {
      id: normalized.id,
      title: normalized.title,
      description: normalized.description,
      date: normalized.date,
      time: normalized.time,
      endDate: normalized.endDate,
      endTime: normalized.endTime,
      hashtags: Array.isArray(normalized.hashtags)
        ? normalized.hashtags.join(",")
        : "",
      completed: normalized.completed,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      deleted: normalized.deleted === true,
      deletedAt: normalized.deletedAt || "",
      recurring: normalized.recurring === true,
      recurrenceType: normalized.recurrenceType || "",
      recurrenceInterval: Number(normalized.recurrenceInterval || 1),
      parentTaskId: normalized.parentTaskId || "",
      owner: normalized.owner || ""
    };
  }

  async function parseJsonResponse(response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("A resposta não veio em JSON. Conteúdo recebido: " + text);
    }
  }

  function isSuccessResponse(data) {
    return data && (data.success === true || data.ok === true);
  }

  function getErrorMessage(data, fallback) {
    if (!data) {
      return fallback;
    }

    return data.message || data.error || fallback;
  }

  function getTasksFromResponse(data) {
    return Array.isArray(data.tasks) ? data.tasks : [];
  }

  async function postJson(body) {
    saveSyncMeta({
      lastAttemptAt: new Date().toISOString(),
      lastError: ""
    });

    let response;

    try {
      response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      saveSyncMeta({
        lastError: error && error.message ? error.message : "Falha de rede."
      });
      throw error;
    }

    const data = await parseJsonResponse(response);

    if (!isSuccessResponse(data)) {
      const message = getErrorMessage(
        data,
        "Erro de comunicação com o Apps Script."
      );

      saveSyncMeta({
        lastError: message
      });

      throw new Error(message);
    }

    saveSyncMeta({
      lastSuccessAt: new Date().toISOString(),
      lastError: ""
    });

    return data;
  }

  async function login(username, password) {
    const data = await postJson({
      action: "login",
      username: String(username || "").trim(),
      password: String(password || "").trim()
    });

    return data;
  }

  async function validateSession(auth) {
    const data = await postJson({
      action: "validateSession",
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim()
    });

    return data;
  }

  async function fetchRemoteTasks(auth) {
    const data = await postJson({
      action: "list",
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim()
    });

    return {
      user: data.user || null,
      tasks: getTasksFromResponse(data).map(normalizeRemoteTask)
    };
  }

  function chooseLatestTask(localTask, remoteTask) {
    const localUpdated = new Date(localTask.updatedAt || localTask.createdAt || 0).getTime();
    const remoteUpdated = new Date(remoteTask.updatedAt || remoteTask.createdAt || 0).getTime();

    if (localUpdated >= remoteUpdated) {
      return TaskStore.normalizeTask(localTask);
    }

    return TaskStore.normalizeTask(remoteTask);
  }

  function mergeTaskCollections(localTasks, remoteTasks) {
    const map = new Map();

    (Array.isArray(remoteTasks) ? remoteTasks : []).forEach(function (task) {
      const normalized = TaskStore.normalizeTask(task);
      map.set(normalized.id, normalized);
    });

    (Array.isArray(localTasks) ? localTasks : []).forEach(function (task) {
      const normalizedLocal = TaskStore.normalizeTask(task);

      if (!map.has(normalizedLocal.id)) {
        map.set(normalizedLocal.id, normalizedLocal);
        return;
      }

      const current = map.get(normalizedLocal.id);
      map.set(normalizedLocal.id, chooseLatestTask(normalizedLocal, current));
    });

    return Array.from(map.values()).sort(function (a, b) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async function syncTasks(localTasks, auth) {
    const normalizedLocalTasks = (Array.isArray(localTasks) ? localTasks : []).map(
      TaskStore.normalizeTask
    );

    const data = await postJson({
      action: "sync",
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim(),
      tasks: normalizedLocalTasks.map(prepareLocalTask)
    });

    const remoteTasks = getTasksFromResponse(data).map(normalizeRemoteTask);
    const mergedTasks = mergeTaskCollections(normalizedLocalTasks, remoteTasks);

    saveSyncMeta({
      pendingLocalChanges: false
    });

    return {
      user: data.user || null,
      tasks: mergedTasks
    };
  }

  return {
    login: login,
    validateSession: validateSession,
    fetchRemoteTasks: fetchRemoteTasks,
    syncTasks: syncTasks,
    getSyncMeta: getSyncMeta,
    saveSyncMeta: saveSyncMeta,
    markPendingLocalChanges: markPendingLocalChanges,
    mergeTaskCollections: mergeTaskCollections
  };
})();