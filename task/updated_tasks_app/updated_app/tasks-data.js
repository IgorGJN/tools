const TaskStore = (function () {
  const STORAGE_KEY = "tasks_tool_items_v2";
  const LEGACY_STORAGE_KEY = "tasks_tool_items_v1";
  const LAST_SYNC_KEY = "tasks_tool_last_sync_v1";
  const PRIVATE_TAG = "privado";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadRaw() {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);

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

  function normalizeHashtags(input) {
    if (Array.isArray(input)) {
      return Array.from(
        new Set(
          input
            .map(function (tag) {
              return String(tag || "").trim().replace(/^#+/, "").toLowerCase();
            })
            .filter(Boolean)
        )
      );
    }

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

  function normalizeDate(value) {
    const stringValue = String(value || "").trim();
    if (!stringValue) {
      return "";
    }

    const isoMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return stringValue;
    }

    const brMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return brMatch[3] + "-" + brMatch[2] + "-" + brMatch[1];
    }

    const parsed = new Date(stringValue);
    if (isNaN(parsed.getTime())) {
      return "";
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function normalizeTime(value) {
    const stringValue = String(value || "").trim();
    if (!stringValue) {
      return "";
    }

    const hhmm = stringValue.match(/^(\d{2}):(\d{2})$/);
    if (hhmm) {
      return stringValue;
    }

    const hhmmss = stringValue.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (hhmmss) {
      return hhmmss[1] + ":" + hhmmss[2];
    }

    const parsed = new Date("1970-01-01T" + stringValue);
    if (isNaN(parsed.getTime())) {
      return "";
    }

    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function normalizeTask(task) {
    const startDate = normalizeDate(task.date || task.startDate || "");
    const startTime = normalizeTime(task.time || task.startTime || "");
    const endDate = normalizeDate(task.endDate || "");
    const endTime = normalizeTime(task.endTime || "");
    const createdAt = String(task.createdAt || new Date().toISOString()).trim();
    const updatedAt = String(task.updatedAt || createdAt).trim();

    const normalized = {
      id: String(task.id || generateId()),
      title: String(task.title || "").trim(),
      description: String(task.description || "").trim(),
      date: startDate,
      time: startTime,
      endDate: endDate,
      endTime: endTime,
      hashtags: normalizeHashtags(task.hashtags || ""),
      completed: task.completed === true || String(task.completed).toLowerCase() === "true",
      createdAt: createdAt,
      updatedAt: updatedAt,
      deleted: task.deleted === true || String(task.deleted).toLowerCase() === "true",
      deletedAt: String(task.deletedAt || "").trim(),
      recurring: task.recurring === true || String(task.recurring).toLowerCase() === "true",
      recurrenceType: task.recurring ? String(task.recurrenceType || "weekly") : String(task.recurrenceType || ""),
      recurrenceInterval: normalizeInterval(task.recurrenceInterval),
      parentTaskId: String(task.parentTaskId || "").trim(),
      owner: String(task.owner || "").trim().toLowerCase()
    };

    if (normalized.endDate && normalized.endDate < normalized.date) {
      normalized.endDate = "";
      normalized.endTime = "";
    }

    if (normalized.endDate === normalized.date && normalized.endTime && normalized.time && normalized.endTime < normalized.time) {
      normalized.endDate = "";
      normalized.endTime = "";
    }

    return normalized;
  }

  function load() {
    const tasks = loadRaw().map(normalizeTask);
    save(tasks);
    return tasks;
  }

  function save(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.map(normalizeTask)));
  }

  function saveLastSync(dateString) {
    localStorage.setItem(LAST_SYNC_KEY, String(dateString || ""));
  }

  function getLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY) || "";
  }

  function createTask(payload, owner) {
    const tasks = load();
    const now = new Date().toISOString();

    const task = normalizeTask({
      id: generateId(),
      title: payload.title,
      description: payload.description,
      date: payload.date,
      time: payload.time,
      endDate: payload.endDate,
      endTime: payload.endTime,
      hashtags: payload.hashtags,
      completed: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: "",
      recurring: payload.recurring === true,
      recurrenceType: payload.recurring ? String(payload.recurrenceType || "weekly") : "",
      recurrenceInterval: payload.recurring ? normalizeInterval(payload.recurrenceInterval) : 1,
      parentTaskId: String(payload.parentTaskId || ""),
      owner: String(owner || "").trim().toLowerCase()
    });

    tasks.push(task);
    save(tasks);
    return task;
  }

  function canEditTask(task, currentUser) {
    return !!task && !!currentUser && String(task.owner || "") === String(currentUser || "").toLowerCase();
  }

  function updateTask(id, payload, currentUser) {
    const tasks = load();
    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1 || !canEditTask(tasks[index], currentUser)) {
      return null;
    }

    tasks[index] = normalizeTask({
      ...tasks[index],
      title: payload.title,
      description: payload.description,
      date: payload.date,
      time: payload.time,
      endDate: payload.endDate,
      endTime: payload.endTime,
      hashtags: payload.hashtags,
      recurring: payload.recurring === true,
      recurrenceType: payload.recurring ? String(payload.recurrenceType || "weekly") : "",
      recurrenceInterval: payload.recurring ? normalizeInterval(payload.recurrenceInterval) : 1,
      updatedAt: new Date().toISOString()
    });

    save(tasks);
    return tasks[index];
  }

  function deleteTask(id, currentUser) {
    const tasks = load();
    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1 || !canEditTask(tasks[index], currentUser)) {
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

  function getDateTimeValueFromParts(date, time, defaultTime) {
    const safeDate = normalizeDate(date);
    const safeTime = normalizeTime(time) || defaultTime || "23:59";

    if (!safeDate) {
      return 0;
    }

    return new Date(safeDate + "T" + safeTime + ":00").getTime();
  }

  function getStartDateTimeValue(task) {
    return getDateTimeValueFromParts(task.date, task.time, "00:00");
  }

  function getEndDateTimeValue(task) {
    if (task.endDate) {
      return getDateTimeValueFromParts(task.endDate, task.endTime, task.time || "23:59");
    }

    return getDateTimeValueFromParts(task.date, task.time, task.time ? task.time : "23:59");
  }

  function buildDateFromMs(timeValue) {
    const date = new Date(timeValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return {
      date: year + "-" + month + "-" + day,
      time: hours + ":" + minutes
    };
  }

  function hasNextRecurringOccurrence(tasks, task) {
    const nextDate = getNextDate(task);

    return tasks.some(function (item) {
      return !item.deleted && item.parentTaskId === task.id && item.date === nextDate;
    });
  }

  function createNextRecurringTask(sourceTask, tasks) {
    if (!sourceTask.recurring || sourceTask.deleted) {
      return null;
    }

    const nextDate = getNextDate(sourceTask);
    if (!nextDate || hasNextRecurringOccurrence(tasks, sourceTask)) {
      return null;
    }

    const now = new Date().toISOString();
    let nextEndDate = "";
    let nextEndTime = "";

    if (sourceTask.endDate) {
      const durationMs = getEndDateTimeValue(sourceTask) - getStartDateTimeValue(sourceTask);
      const nextStartMs = getDateTimeValueFromParts(nextDate, sourceTask.time, sourceTask.time || "00:00");
      const nextEnd = buildDateFromMs(nextStartMs + durationMs);
      nextEndDate = nextEnd.date;
      nextEndTime = sourceTask.endTime ? nextEnd.time : "";
    }

    const nextTask = normalizeTask({
      id: generateId(),
      title: sourceTask.title,
      description: sourceTask.description,
      date: nextDate,
      time: sourceTask.time || "",
      endDate: nextEndDate,
      endTime: nextEndTime,
      hashtags: Array.isArray(sourceTask.hashtags) ? sourceTask.hashtags.slice() : [],
      completed: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: "",
      recurring: sourceTask.recurring === true,
      recurrenceType: sourceTask.recurrenceType || "",
      recurrenceInterval: normalizeInterval(sourceTask.recurrenceInterval),
      parentTaskId: sourceTask.id,
      owner: sourceTask.owner || ""
    });

    tasks.push(nextTask);
    return nextTask;
  }

  function toggleTask(id, currentUser) {
    const tasks = load();
    const index = tasks.findIndex(function (task) {
      return task.id === id;
    });

    if (index === -1 || !canEditTask(tasks[index], currentUser)) {
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

  function taskIntersectsDate(task, dateIso) {
    if (!dateIso || !task.date) {
      return false;
    }

    const startDate = task.date;
    const endDate = task.endDate || task.date;
    return startDate <= dateIso && endDate >= dateIso;
  }

  function getStatus(task) {
    if (task.completed) {
      return "completed";
    }

    const today = todayISO();
    const startDate = task.date || "";
    const endDate = task.endDate || task.date || "";

    if (endDate && endDate < today) {
      return "overdue";
    }

    if (startDate <= today && endDate >= today) {
      return "today";
    }

    return "upcoming";
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

      const dateDiff = getStartDateTimeValue(a) - getStartDateTimeValue(b);

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
        return getStartDateTimeValue(a) - getStartDateTimeValue(b);
      });
    }

    if (mode === "date-desc") {
      return list.sort(function (a, b) {
        return getStartDateTimeValue(b) - getStartDateTimeValue(a);
      });
    }

    if (mode === "created-desc") {
      return list.sort(function (a, b) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return smartSort(list);
  }

  function hasPrivateTag(task) {
    return Array.isArray(task.hashtags) && task.hashtags.includes(PRIVATE_TAG);
  }

  function isTaskVisibleForUser(task, username, visibility) {
    const user = String(username || "").trim().toLowerCase();
    if (!user || task.deleted) {
      return false;
    }

    const owner = String(task.owner || "").trim().toLowerCase();
    const isMine = owner === user;
    const isPrivate = hasPrivateTag(task);

    if (visibility === "mine") {
      return isMine;
    }

    if (visibility === "shared") {
      return !isMine && !isPrivate;
    }

    return isMine || (!isMine && !isPrivate);
  }

  function filterTasks(tasks, filters) {
    const search = String(filters.search || "").trim().toLowerCase();
    const statusFilter = filters.status || "all";
    const tagFilter = filters.tag || "";
    const dateFilter = filters.date || "";

    return tasks.filter(function (task) {
      if (task.deleted) {
        return false;
      }

      const title = String(task.title || "").toLowerCase();
      const description = String(task.description || "").toLowerCase();
      const status = getStatus(task);

      const inText = !search || title.includes(search) || description.includes(search);

      const inStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !task.completed) ||
        statusFilter === status;

      const inTag = !tagFilter || (Array.isArray(task.hashtags) && task.hashtags.includes(tagFilter));
      const inDate = !dateFilter || taskIntersectsDate(task, dateFilter);

      return inText && inStatus && inTag && inDate;
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

  function setTasks(tasks) {
    save(tasks.map(normalizeTask));
  }

  function getVisibleTasksForUser(tasks, username, visibility) {
    return tasks.filter(function (task) {
      return isTaskVisibleForUser(task, username, visibility);
    });
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
    getUpcoming: getUpcoming,
    canEditTask: canEditTask,
    isTaskVisibleForUser: isTaskVisibleForUser,
    getVisibleTasksForUser: getVisibleTasksForUser,
    taskIntersectsDate: taskIntersectsDate,
    setTasks: setTasks,
    hasPrivateTag: hasPrivateTag,
    normalizeTask: normalizeTask,
    clone: clone,
    PRIVATE_TAG: PRIVATE_TAG
  };
})();
