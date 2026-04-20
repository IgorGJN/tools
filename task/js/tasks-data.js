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

  function normalizeInterval(value) {
    const num = Number(value);

    if (!Number.isFinite(num) || num < 1) {
      return 1;
    }

    return Math.floor(num);
  }

  function createTask(payload) {
    const tasks = load();
    const now = new Date().toISOString();

    const task = {
      id: generateId(),
      title: String(payload.title || "").trim(),
      description: String(payload.description || "").trim(),
      date: String(payload.date || "").trim(),
      time: String(payload.time || "").trim(),
      hashtags: normalizeHashtags(payload.hashtags || ""),
      completed: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: "",
      recurring: payload.recurring === true,
      recurrenceType: payload.recurring ? String(payload.recurrenceType || "weekly") : "",
      recurrenceInterval: payload.recurring ? normalizeInterval(payload.recurrenceInterval) : 1,
      parentTaskId: String(payload.parentTaskId || "")
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
      date: String(payload.date || "").trim(),
      time: String(payload.time || "").trim(),
      hashtags: normalizeHashtags(payload.hashtags || ""),
      recurring: payload.recurring === true,
      recurrenceType: payload.recurring ? String(payload.recurrenceType || "weekly") : "",
      recurrenceInterval: payload.recurring ? normalizeInterval(payload.recurrenceInterval) : 1,
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

  function addDays(dateString, amount) {
    const parts = dateString.split("-");
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + amount);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function addMonths(dateString, amount) {
    const parts = dateString.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(year, month, day);
    date.setMonth(date.getMonth() + amount);

    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newDay = String(date.getDate()).padStart(2, "0");

    return newYear + "-" + newMonth + "-" + newDay;
  }

  function addYears(dateString, amount) {
    const parts = dateString.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(year, month, day);
    date.setFullYear(date.getFullYear() + amount);

    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newDay = String(date.getDate()).padStart(2, "0");

    return newYear + "-" + newMonth + "-" + newDay;
  }

  function getNextDate(task) {
    const interval = normalizeInterval(task.recurrenceInterval);

    if (task.recurrenceType === "daily") {
      return addDays(task.date, interval);
    }

    if (task.recurrenceType === "weekly") {
      return addDays(task.date, interval * 7);
    }

    if (task.recurrenceType === "monthly") {
      return addMonths(task.date, interval);
    }

    if (task.recurrenceType === "yearly") {
      return addYears(task.date, interval);
    }

    return "";
  }

  function hasNextRecurringOccurrence(tasks, task) {
    const nextDate = getNextDate(task);

    return tasks.some(function (item) {
      return (
        !item.deleted &&
        item.parentTaskId === task.id &&
        item.date === nextDate
      );
    });
  }

  function createNextRecurringTask(sourceTask, tasks) {
    if (!sourceTask.recurring || sourceTask.deleted) {
      return null;
    }

    const nextDate = getNextDate(sourceTask);

    if (!nextDate) {
      return null;
    }

    if (hasNextRecurringOccurrence(tasks, sourceTask)) {
      return null;
    }

    const now = new Date().toISOString();

    const nextTask = {
      id: generateId(),
      title: sourceTask.title,
      description: sourceTask.description,
      date: nextDate,
      time: sourceTask.time || "",
      hashtags: Array.isArray(sourceTask.hashtags) ? sourceTask.hashtags.slice() : [],
      completed: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: "",
      recurring: sourceTask.recurring === true,
      recurrenceType: sourceTask.recurrenceType || "",
      recurrenceInterval: normalizeInterval(sourceTask.recurrenceInterval),
      parentTaskId: sourceTask.id
    };

    tasks.push(nextTask);
    return nextTask;
  }

  function toggleTask(id) {
    const tasks = load();

    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1) {
      return null;
    }

    const wasCompleted = tasks[index].completed;

    tasks[index].completed = !tasks[index].completed;
    tasks[index].updatedAt = new Date().toISOString();

    if (!wasCompleted && tasks[index].completed && tasks[index].recurring) {
      createNextRecurringTask(tasks[index], tasks);
    }

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
    const safeDate = String(task.date || "").trim();
    const safeTime = String(task.time || "").trim() || "23:59";

    if (!safeDate) {
      return 0;
    }

    return new Date(safeDate + "T" + safeTime + ":00").getTime();
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
      if (task.deleted || task.completed || !Array.isArray(task.hashtags)) {
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