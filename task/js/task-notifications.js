window.TaskNotifications = (function () {
  const SETTINGS_KEY = "tasks_notification_settings_v1";
  const SENT_KEY = "tasks_notification_sent_v1";

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        dailyReminderTime: saved.dailyReminderTime || "06:00",
        hoursBefore: Number.isFinite(Number(saved.hoursBefore)) ? Number(saved.hoursBefore) : 2
      };
    } catch (error) {
      return {
        dailyReminderTime: "06:00",
        hoursBefore: 2
      };
    }
  }

  function saveSettings(nextSettings) {
    const current = getSettings();
    const merged = {
      ...current,
      ...nextSettings
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  }

  function getSentMap() {
    try {
      return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveSentMap(map) {
    localStorage.setItem(SENT_KEY, JSON.stringify(map));
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker não suportado.");
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      return registration;
    } catch (error) {
      console.error("Erro ao registrar Service Worker:", error);
      return null;
    }
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      return "unsupported";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      return "denied";
    }

    return await Notification.requestPermission();
  }

  async function showNotification(title, options) {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification(title, {
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: "task-reminder",
      renotify: false,
      ...options
    });

    return true;
  }

  async function showTestNotification() {
    return await showNotification("Notificações ativadas", {
      body: "Seu app está pronto para mostrar lembretes.",
      tag: "task-test"
    });
  }

  function parseLocalDate(dateString) {
    if (!dateString) return null;

    const parts = String(dateString).split("-");
    if (parts.length !== 3) return null;

    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(year, month, day, 0, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  function parseLocalDateTime(dateString, timeString) {
    const base = parseLocalDate(dateString);
    if (!base) return null;

    const safeTime = String(timeString || "").trim();
    if (!safeTime) {
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    }

    const parts = safeTime.split(":");
    const hours = Number(parts[0] || 0);
    const minutes = Number(parts[1] || 0);

    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
  }

  function formatDateBR(dateString) {
    if (!dateString) return "";
    const parts = String(dateString).split("-");
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function getTodayAt(timeString) {
    const now = new Date();
    const parts = String(timeString || "06:00").split(":");
    const hours = Number(parts[0] || 6);
    const minutes = Number(parts[1] || 0);

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );
  }

  function getDateAt(dateString, timeString) {
    const date = parseLocalDate(dateString);
    if (!date) return null;

    const parts = String(timeString || "06:00").split(":");
    const hours = Number(parts[0] || 6);
    const minutes = Number(parts[1] || 0);

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
      0,
      0
    );
  }

  function isPending(task) {
    return !!task && !task.deleted && !task.completed;
  }

  function getReminderPlan(task, now = new Date()) {
    const settings = getSettings();

    if (!isPending(task) || !task.date) {
      return null;
    }

    const taskDate = parseLocalDate(task.date);
    if (!taskDate) {
      return null;
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // atraso
    if (taskDate < todayStart) {
      const remindAt = getTodayAt(settings.dailyReminderTime);
      return {
        type: "overdue",
        remindAt,
        key: `${task.id}::overdue::${task.date}::${remindAt.getFullYear()}-${String(remindAt.getMonth() + 1).padStart(2, "0")}-${String(remindAt.getDate()).padStart(2, "0")}`,
        title: task.title || "Tarefa atrasada",
        body: `Tarefa atrasada desde ${formatDateBR(task.date)}.`
      };
    }

    // com hora
    if (task.time) {
      const taskDateTime = parseLocalDateTime(task.date, task.time);
      if (!taskDateTime) {
        return null;
      }

      const remindAt = new Date(taskDateTime.getTime() - settings.hoursBefore * 60 * 60 * 1000);

      return {
        type: "timed",
        remindAt,
        key: `${task.id}::timed::${task.date}::${task.time}::${settings.hoursBefore}`,
        title: task.title || "Lembrete de tarefa",
        body: `Hoje às ${task.time} • lembrete ${settings.hoursBefore}h antes.`
      };
    }

    // sem hora
    const remindAt = getDateAt(task.date, settings.dailyReminderTime);

    return {
      type: "daily",
      remindAt,
      key: `${task.id}::daily::${task.date}::${settings.dailyReminderTime}`,
      title: task.title || "Lembrete de tarefa",
      body: `Tarefa pendente para hoje • aviso das ${settings.dailyReminderTime}.`
    };
  }

  async function processTasks(tasks) {
    if (!Array.isArray(tasks) || !tasks.length) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const now = new Date();
    const sentMap = getSentMap();
    let changed = false;

    for (const task of tasks) {
      const plan = getReminderPlan(task, now);
      if (!plan || !plan.remindAt) {
        continue;
      }

      if (now >= plan.remindAt && !sentMap[plan.key]) {
        const ok = await showNotification(plan.title, {
          body: plan.body,
          tag: `task-${task.id}`
        });

        if (ok) {
          sentMap[plan.key] = new Date().toISOString();
          changed = true;
        }
      }
    }

    if (changed) {
      saveSentMap(sentMap);
    }
  }

  return {
    registerServiceWorker,
    requestPermission,
    showTestNotification,
    processTasks,
    getSettings,
    saveSettings
  };
})();