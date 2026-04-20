const TaskSync = (function () {
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxV6lPXjSzkjU9S_bXQ_RKHpwQLaHdO2Rn2IB0I7f6d_9nHQa01XALpkedxopOzqsmM1A/exec";

  function normalizeRemoteTask(task) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      date: task.date,
      time: task.time,
      hashtags: String(task.hashtags || "")
        .split(",")
        .map(function (tag) {
          return tag.trim().replace(/^#+/, "").toLowerCase();
        })
        .filter(function (tag) {
          return tag.length > 0;
        }),
      completed:
        task.completed === true ||
        String(task.completed).toLowerCase() === "true",
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deleted:
        task.deleted === true ||
        String(task.deleted).toLowerCase() === "true",
      deletedAt: task.deletedAt || "",
      recurring:
        task.recurring === true ||
        String(task.recurring).toLowerCase() === "true",
      recurrenceType: task.recurrenceType || "",
      recurrenceInterval: Number(task.recurrenceInterval || 1),
      parentTaskId: task.parentTaskId || ""
    };
  }

  function prepareLocalTask(task) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      date: task.date,
      time: task.time,
      hashtags: Array.isArray(task.hashtags) ? task.hashtags.join(",") : "",
      completed: task.completed,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deleted: task.deleted === true,
      deletedAt: task.deletedAt || "",
      recurring: task.recurring === true,
      recurrenceType: task.recurrenceType || "",
      recurrenceInterval: Number(task.recurrenceInterval || 1),
      parentTaskId: task.parentTaskId || ""
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

  async function fetchRemoteTasks() {
    const response = await fetch(WEB_APP_URL + "?action=list");
    const data = await parseJsonResponse(response);

    if (!isSuccessResponse(data)) {
      throw new Error(getErrorMessage(data, "Erro ao buscar dados remotos."));
    }

    return getTasksFromResponse(data).map(normalizeRemoteTask);
  }

  async function syncTasks(localTasks) {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "sync",
        tasks: localTasks.map(prepareLocalTask)
      })
    });

    const data = await parseJsonResponse(response);

    if (!isSuccessResponse(data)) {
      throw new Error(getErrorMessage(data, "Erro na sincronização."));
    }

    return getTasksFromResponse(data).map(normalizeRemoteTask);
  }

  return {
    fetchRemoteTasks: fetchRemoteTasks,
    syncTasks: syncTasks
  };
})();