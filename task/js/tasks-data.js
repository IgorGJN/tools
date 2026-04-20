const TaskStore = (function () {
  const STORAGE_KEY = "tasks_tool_items_v1";
  const LAST_SYNC_KEY = "tasks_tool_last_sync_v1";

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Erro ao ler tarefas do localStorage:", error);
      return [];
    }
  }

  function save(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function saveLastSync(dateString) {
    localStorage.setItem(LAST_SYNC_KEY, String(dateString || ""));
  }

  function getLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY) || "";
  }

  function normalizeHashtags(input) {
    if (!input || typeof input !== "string") {
      return [];
    }

    const parts = input
      .split(/[\s,]+/)
      .map(function (tag) {
        return tag.trim().replace(/^#+/, "").toLowerCase();
      })
      .filter(function (tag) {
        return tag.length > 0;
      });

    return Array.from(new Set(parts));
  }

  function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "task-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function createTask(payload) {
    const tasks = load();
    const now = new Date().toISOString();

    const task = {
      id: generateId(),
      title: String(payload.title || "").trim(),
      description: String(payload.description || "").trim(),
      date: String(payload.date || ""),
      time: String(payload.time || ""),
      hashtags: normalizeHashtags(payload.hashtags || ""),
      completed: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: ""
    };

    tasks.push(task);
    save(tasks);
    return task;
  }

  function updateTask(id, payload) {
    const tasks = load();

    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1) {
      return null;
    }

    tasks[index] = {
      ...tasks[index],
      title: String(payload.title || "").trim(),
      description: String(payload.description || "").trim(),
      date: String(payload.date || ""),
      time: String(payload.time || ""),
      hashtags: normalizeHashtags(payload.hashtags || ""),
      updatedAt: new Date().toISOString()
    };

    save(tasks);
    return tasks[index];
  }

  function deleteTask(id) {
    const tasks = load();

    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1) {
      return null;
    }

    const now = new Date().toISOString();

    tasks[index].deleted = true;
    tasks[index].deletedAt = now;
    tasks[index].updatedAt = now;

    save(tasks);
    return tasks[index];
  }

  function toggleTask(id) {
    const tasks = load();

    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1) {
      return null;
    }

    tasks[index].completed = !tasks[index].completed;
    tasks[index].updatedAt = new Date().toISOString();

    save(tasks);
    return tasks[index];
  }

  function getTaskById(id) {
    const tasks = load();

    return (
      tasks.find(function (task) {
        return task.id === id;
      }) || null
    );
  }

  function getStatus(task) {
    if (task.completed) {
      return "completed";
    }

    const today = todayISO();

    if (task.date < today) {
      return "overdue";
    }

    if (task.date === today) {
      return "today";
    }

    return "upcoming";
  }

  function getDateTimeValue(task) {
    const safeTime = task.time && task.time.trim() ? task.time : "23:59";
    return new Date(task.date + "T" + safeTime + ":00").getTime();
  }

  function smartSort(tasks) {
    const weight = {
      overdue: 0,
      today: 1,
      upcoming: 2,
      completed: 3
    };

    return tasks.slice().sort(function (a, b) {
      const statusA = getStatus(a);
      const statusB = getStatus(b);
      const statusDiff = weight[statusA] - weight[statusB];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const dateDiff = getDateTimeValue(a) - getDateTimeValue(b);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function sortTasks(tasks, mode) {
    const list = tasks.slice();

    if (mode === "date-asc") {
      return list.sort(function (a, b) {
        return getDateTimeValue(a) - getDateTimeValue(b);
      });
    }

    if (mode === "date-desc") {
      return list.sort(function (a, b) {
        return getDateTimeValue(b) - getDateTimeValue(a);
      });
    }

    if (mode === "created-desc") {
      return list.sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return smartSort(list);
  }

  function filterTasks(tasks, filters) {
    const search = String(filters.search || "").trim().toLowerCase();
    const statusFilter = filters.status || "all";
    const tagFilter = filters.tag || "";

    return tasks.filter(function (task) {
      if (task.deleted) {
        return false;
      }

      const title = String(task.title || "").toLowerCase();
      const description = String(task.description || "").toLowerCase();
      const status = getStatus(task);

      const inText =
        !search ||
        title.includes(search) ||
        description.includes(search);

      const inStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !task.completed) ||
        statusFilter === status;

      const inTag =
        !tagFilter ||
        (Array.isArray(task.hashtags) && task.hashtags.includes(tagFilter));

      return inText && inStatus && inTag;
    });
  }

  function buildSummary(tasks) {
    const visibleTasks = tasks.filter(function (task) {
      return !task.deleted;
    });

    return {
      total: visibleTasks.length,
      pending: visibleTasks.filter(function (task) {
        return !task.completed;
      }).length,
      completed: visibleTasks.filter(function (task) {
        return task.completed;
      }).length,
      overdue: visibleTasks.filter(function (task) {
        return getStatus(task) === "overdue";
      }).length
    };
  }

  function allHashtags(tasks) {
    const counts = {};

    tasks.forEach(function (task) {
      if (task.deleted || !Array.isArray(task.hashtags)) {
        return;
      }

      task.hashtags.forEach(function (tag) {
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
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.tag.localeCompare(b.tag);
      });
  }

  function getUpcoming(tasks, limit) {
    const max = typeof limit === "number" ? limit : 5;

    return smartSort(tasks)
      .filter(function (task) {
        return !task.completed && !task.deleted;
      })
      .slice(0, max);
  }

  return {
    load: load,
    save: save,
    saveLastSync: saveLastSync,
    getLastSync: getLastSync,
    createTask: createTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    toggleTask: toggleTask,
    getTaskById: getTaskById,
    getStatus: getStatus,
    sortTasks: sortTasks,
    filterTasks: filterTasks,
    buildSummary: buildSummary,
    allHashtags: allHashtags,
    todayISO: todayISO,
    getUpcoming: getUpcoming
  };
})();