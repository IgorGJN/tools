const TaskSync = (function () {
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwvJiRo_jqRiVVVE-fE8wm9vLGLYgKNEZ0kjaQV86Di1q1I4mOjEXGtqWmG1j37ao2mZg/exec";

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
      updatedAt: task.updatedAt
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
      updatedAt: task.updatedAt
    };
  }

  async function parseJsonResponse(response) {
    const text = await response.text();

    console.log("HTTP status:", response.status);
    console.log("Resposta bruta:", text);

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("A resposta não veio em JSON. Conteúdo recebido: " + text);
    }
  }

  async function fetchRemoteTasks() {
    const response = await fetch(WEB_APP_URL + "?action=list");
    const data = await parseJsonResponse(response);

    if (!data.success) {
      throw new Error(data.message || "Erro ao buscar dados remotos.");
    }

    return (data.tasks || []).map(normalizeRemoteTask);
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

    if (!data.success) {
      throw new Error(data.message || "Erro na sincronização.");
    }

    return (data.tasks || []).map(normalizeRemoteTask);
  }

  return {
    fetchRemoteTasks: fetchRemoteTasks,
    syncTasks: syncTasks
  };
})();