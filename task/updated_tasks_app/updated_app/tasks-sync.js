const TaskSync = (function () {
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxV6lPXjSzkjU9S_bXQ_RKHpwQLaHdO2Rn2IB0I7f6d_9nHQa01XALpkedxopOzqsmM1A/exec";

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
      hashtags: Array.isArray(normalized.hashtags) ? normalized.hashtags.join(",") : "",
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
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(body)
    });

    const data = await parseJsonResponse(response);

    if (!isSuccessResponse(data)) {
      throw new Error(getErrorMessage(data, "Erro de comunicação com o Apps Script."));
    }

    return data;
  }

  async function login(username, password) {
    return postJson({
      action: "login",
      username: String(username || "").trim(),
      password: String(password || "").trim()
    });
  }

  async function validateSession(auth) {
    return postJson({
      action: "validateSession",
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim()
    });
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

  async function syncTasks(localTasks, auth) {
    const data = await postJson({
      action: "sync",
      username: String((auth && auth.username) || "").trim(),
      password: String((auth && auth.password) || "").trim(),
      tasks: (Array.isArray(localTasks) ? localTasks : []).map(prepareLocalTask)
    });

    return {
      user: data.user || null,
      tasks: getTasksFromResponse(data).map(normalizeRemoteTask)
    };
  }

  return {
    login: login,
    validateSession: validateSession,
    fetchRemoteTasks: fetchRemoteTasks,
    syncTasks: syncTasks
  };
})();
