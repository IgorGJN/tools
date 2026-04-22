const TaskUI = (function () {
  const elements = {
    totalTasks: document.getElementById("totalTasks"),
    pendingTasks: document.getElementById("pendingTasks"),
    completedTasks: document.getElementById("completedTasks"),
    overdueTasks: document.getElementById("overdueTasks"),

    taskList: document.getElementById("taskList"),
    overdueList: document.getElementById("overdueList"),
    upcomingList: document.getElementById("upcomingList"),
    allTasksGrouped: document.getElementById("allTasksGrouped"),
    calendarDayTaskList: document.getElementById("calendarDayTaskList"),

    emptyState: document.getElementById("emptyState"),
    hashtagsPanel: document.getElementById("hashtagsPanel"),
    taskCountLabel: document.getElementById("taskCountLabel"),
    toastContainer: document.getElementById("toastContainer"),

    overdueInlineCount: document.getElementById("overdueInlineCount"),
    selectedDayLabel: document.getElementById("selectedDayLabel"),
    dayTasksPanel: document.getElementById("dayTasksPanel")
  };

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeDate(date) {
    const value = String(date || "").trim();

    if (!value) {
      return "";
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return value;
    }

    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return brMatch[3] + "-" + brMatch[2] + "-" + brMatch[1];
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }

    return "";
  }

  function normalizeTime(time) {
    const value = String(time || "").trim();

    if (!value) {
      return "";
    }

    const hhmm = value.match(/^(\d{2}):(\d{2})$/);
    if (hhmm) {
      return value;
    }

    const hhmmss = value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    if (hhmmss) {
      return hhmmss[1] + ":" + hhmmss[2];
    }

    const timeInsideText = value.match(/(\d{2}):(\d{2})/);
    if (timeInsideText) {
      return timeInsideText[1] + ":" + timeInsideText[2];
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const hours = String(parsed.getHours()).padStart(2, "0");
      const minutes = String(parsed.getMinutes()).padStart(2, "0");
      return hours + ":" + minutes;
    }

    return "";
  }

  function formatSingleDate(date, time) {
    const normalizedDate = normalizeDate(date);
    const normalizedTime = normalizeTime(time);

    if (!normalizedDate) {
      return "Sem data";
    }

    const parts = normalizedDate.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const baseDate = new Date(year, month, day);

    if (isNaN(baseDate.getTime())) {
      return "Sem data";
    }

    const formatted = baseDate.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });

    if (normalizedTime) {
      return formatted + " • " + normalizedTime;
    }

    return formatted;
  }

  function formatDateRange(task) {
    const start = formatSingleDate(task.date, task.time);
    const hasEnd = !!task.endDate;

    if (!hasEnd) {
      return start;
    }

    const sameDay = normalizeDate(task.date) === normalizeDate(task.endDate);

    if (sameDay) {
      const endTime = normalizeTime(task.endTime);
      if (endTime) {
        return start + " → " + endTime;
      }
      return start;
    }

    return start + " → " + formatSingleDate(task.endDate, task.endTime);
  }

  function formatRecurrence(task) {
    if (!task || task.recurring !== true) {
      return "";
    }

    const interval = Number(task.recurrenceInterval || 1);

    if (task.recurrenceType === "daily") {
      return interval === 1
        ? "Recorrente • todo dia"
        : "Recorrente • a cada " + interval + " dias";
    }

    if (task.recurrenceType === "weekly") {
      return interval === 1
        ? "Recorrente • toda semana"
        : "Recorrente • a cada " + interval + " semanas";
    }

    if (task.recurrenceType === "monthly") {
      return interval === 1
        ? "Recorrente • todo mês"
        : "Recorrente • a cada " + interval + " meses";
    }

    if (task.recurrenceType === "yearly") {
      return interval === 1
        ? "Recorrente • todo ano"
        : "Recorrente • a cada " + interval + " anos";
    }

    return "Recorrente";
  }

  function statusMeta(status) {
    const map = {
      overdue: {
        label: "Atrasada",
        className: "overdue",
        cardClass: "status-overdue"
      },
      today: {
        label: "Hoje",
        className: "today",
        cardClass: "status-today"
      },
      upcoming: {
        label: "Agendada",
        className: "upcoming",
        cardClass: "status-upcoming"
      },
      completed: {
        label: "Concluída",
        className: "completed",
        cardClass: "status-completed"
      }
    };

    return map[status] || map.upcoming;
  }

  function formatGroupLabel(dateIso) {
    const today = TaskStore.todayISO();
    const tomorrow = addDays(today, 1);

    if (dateIso === today) {
      return "Hoje";
    }

    if (dateIso === tomorrow) {
      return "Amanhã";
    }

    const parsed = new Date(dateIso + "T00:00:00");
    if (isNaN(parsed.getTime())) {
      return dateIso;
    }

    return parsed.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
  }

  function addDays(dateIso, amount) {
    const parts = String(dateIso || "").split("-");
    if (parts.length !== 3) {
      return "";
    }

    const date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );

    date.setDate(date.getDate() + amount);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function renderSummary(summary) {
    if (elements.totalTasks) {
      elements.totalTasks.textContent = summary.total;
    }
    if (elements.pendingTasks) {
      elements.pendingTasks.textContent = summary.pending;
    }
    if (elements.completedTasks) {
      elements.completedTasks.textContent = summary.completed;
    }
    if (elements.overdueTasks) {
      elements.overdueTasks.textContent = summary.overdue;
    }
    if (elements.overdueInlineCount) {
      elements.overdueInlineCount.textContent = summary.overdue;
    }
  }

  function renderHashtags(tags, activeTag) {
    if (!elements.hashtagsPanel) {
      return;
    }

    if (!tags.length) {
      elements.hashtagsPanel.innerHTML =
        '<span class="tag-empty">Nenhuma hashtag com pendências</span>';
      return;
    }

    let html = "";
    html +=
      '<button class="tag-chip' +
      (activeTag === "" ? " active" : "") +
      '" data-tag="">Todas</button>';

    tags.forEach(function (item) {
      html +=
        '<button class="tag-chip' +
        (activeTag === item.tag ? " active" : "") +
        '" data-tag="' +
        escapeHtml(item.tag) +
        '">#' +
        escapeHtml(item.tag) +
        " (" +
        item.count +
        ")</button>";
    });

    elements.hashtagsPanel.innerHTML = html;
  }

  function buildTaskCard(task, currentUsername) {
    const status = TaskStore.getStatus(task);
    const meta = statusMeta(status);
    const recurrenceText = formatRecurrence(task);
    const isMine =
      String(task.owner || "") === String(currentUsername || "").toLowerCase();

    let html = "";

    html += '<article class="task-card ' + meta.cardClass;
    if (task.completed) {
      html += " completed";
    }
    if (!isMine) {
      html += " shared-card";
    }
    html += '">';

    html += '<div class="task-top">';
    html += '<div class="task-title-wrap">';

    html +=
      '<input class="task-check" type="checkbox" data-action="toggle" data-id="' +
      task.id +
      '"' +
      (task.completed ? " checked" : "") +
      (isMine ? "" : " disabled") +
      " />";

    html += "<div>";
    html += '<h3 class="task-title">' + escapeHtml(task.title) + "</h3>";

    if (task.description) {
      html +=
        '<p class="task-description">' +
        escapeHtml(task.description) +
        "</p>";
    }

    html += "</div>";
    html += "</div>";

    html += '<div class="task-actions">';
    html +=
      '<button class="action-btn" type="button" data-action="edit" data-id="' +
      task.id +
      '"' +
      (isMine ? "" : " disabled") +
      ">Editar</button>";
    html +=
      '<button class="action-btn" type="button" data-action="delete" data-id="' +
      task.id +
      '"' +
      (isMine ? "" : " disabled") +
      ">Excluir</button>";
    html += "</div>";
    html += "</div>";

    html += '<div class="task-meta">';
    html +=
      '<span class="status-badge ' +
      meta.className +
      '">' +
      meta.label +
      "</span>";
    html +=
      '<span class="meta-pill">' +
      escapeHtml(formatDateRange(task)) +
      "</span>";
    html +=
      '<span class="owner-pill' +
      (isMine ? "" : " shared") +
      '">' +
      (isMine
        ? "Minha"
        : "Compartilhada por @" + escapeHtml(task.owner || "")) +
      "</span>";

    if (recurrenceText) {
      html +=
        '<span class="meta-pill recurrence-pill">' +
        escapeHtml(recurrenceText) +
        "</span>";
    }

    html += "</div>";

    html += '<div class="task-tags">';
    if (task.hashtags && task.hashtags.length) {
      task.hashtags.forEach(function (tag) {
        html +=
          '<button class="tag-chip task-tag" type="button" data-tag="' +
          escapeHtml(tag) +
          '">#' +
          escapeHtml(tag) +
          "</button>";
      });
    } else {
      html += '<span class="tag-empty">Sem hashtags</span>';
    }
    html += "</div>";

    html += "</article>";

    return html;
  }

  function renderTaskList(container, tasks, currentUsername, emptyHtml) {
    if (!container) {
      return;
    }

    if (!tasks || !tasks.length) {
      container.innerHTML =
        emptyHtml ||
        '<div class="upcoming-card"><p class="task-description">Nenhum item encontrado.</p></div>';
      return;
    }

    let html = "";
    tasks.forEach(function (task) {
      html += buildTaskCard(task, currentUsername);
    });

    container.innerHTML = html;
  }

  function renderTasks(tasks, currentUsername) {
    if (elements.taskCountLabel) {
      elements.taskCountLabel.textContent =
        tasks.length + " " + (tasks.length === 1 ? "item" : "itens");
    }

    if (!tasks.length) {
      if (elements.taskList) {
        elements.taskList.innerHTML = "";
      }
      if (elements.emptyState) {
        elements.emptyState.classList.remove("hidden");
      }
      return;
    }

    if (elements.emptyState) {
      elements.emptyState.classList.add("hidden");
    }

    renderTaskList(elements.taskList, tasks, currentUsername, "");
  }

  function renderOverdue(tasks, currentUsername) {
    renderTaskList(
      elements.overdueList,
      tasks,
      currentUsername,
      '<div class="upcoming-card"><p class="task-description">Nenhuma tarefa atrasada.</p></div>'
    );
  }

  function renderUpcoming(tasks) {
    if (!elements.upcomingList) {
      return;
    }

    if (!tasks.length) {
      elements.upcomingList.innerHTML =
        '<div class="upcoming-card"><p class="task-description">Nenhuma tarefa pendente.</p></div>';
      return;
    }

    let html = "";

    tasks.forEach(function (task) {
      html += '<article class="upcoming-card">';
      html +=
        '<h3 class="upcoming-title">' + escapeHtml(task.title) + "</h3>";
      html +=
        '<div class="upcoming-date">' +
        escapeHtml(formatDateRange(task)) +
        "</div>";
      html += "</article>";
    });

    elements.upcomingList.innerHTML = html;
  }

  function renderGroupedTasks(tasks, currentUsername) {
    if (!elements.allTasksGrouped) {
      return;
    }

    if (!tasks.length) {
      elements.allTasksGrouped.innerHTML =
        '<div class="upcoming-card"><p class="task-description">Nenhuma atividade encontrada.</p></div>';
      return;
    }

    const groups = {};

    tasks.forEach(function (task) {
      const groupKey = normalizeDate(task.date || "") || "sem-data";
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    const orderedKeys = Object.keys(groups).sort();

    let html = "";

    orderedKeys.forEach(function (key) {
      html += '<section class="group-block">';
      html += '<div class="section-header">';
      html += "<div>";
      html += "<h2>" + escapeHtml(formatGroupLabel(key)) + "</h2>";
      html += "</div>";
      html +=
        '<span class="section-count">' + groups[key].length + " itens</span>";
      html += "</div>";
      html += '<div class="task-list">';

      groups[key].forEach(function (task) {
        html += buildTaskCard(task, currentUsername);
      });

      html += "</div>";
      html += "</section>";
    });

    elements.allTasksGrouped.innerHTML = html;
  }

  function renderCalendarDayTasks(tasks, currentUsername, dayLabel) {
    if (!elements.dayTasksPanel || !elements.calendarDayTaskList) {
      return;
    }

    elements.dayTasksPanel.classList.remove("hidden");

    if (elements.selectedDayLabel) {
      elements.selectedDayLabel.textContent =
        dayLabel || "Atividades do dia selecionado";
    }

    if (!tasks.length) {
      elements.calendarDayTaskList.innerHTML =
        '<div class="upcoming-card"><p class="task-description">Nenhuma atividade neste dia.</p></div>';
      return;
    }

    let html = "";
    tasks.forEach(function (task) {
      html += buildTaskCard(task, currentUsername);
    });

    elements.calendarDayTaskList.innerHTML = html;
  }

  function hideCalendarDayTasks() {
    if (elements.dayTasksPanel) {
      elements.dayTasksPanel.classList.add("hidden");
    }
    if (elements.calendarDayTaskList) {
      elements.calendarDayTaskList.innerHTML = "";
    }
    if (elements.selectedDayLabel) {
      elements.selectedDayLabel.textContent = "Selecione um dia no calendário.";
    }
  }

  function showToast(message) {
    if (!elements.toastContainer) {
      console.warn("toastContainer não encontrado.");
      return;
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2600);
  }

  return {
    renderSummary: renderSummary,
    renderHashtags: renderHashtags,
    renderTasks: renderTasks,
    renderOverdue: renderOverdue,
    renderUpcoming: renderUpcoming,
    renderGroupedTasks: renderGroupedTasks,
    renderCalendarDayTasks: renderCalendarDayTasks,
    hideCalendarDayTasks: hideCalendarDayTasks,
    showToast: showToast,
    normalizeDate: normalizeDate,
    normalizeTime: normalizeTime,
    formatDateRange: formatDateRange,
    formatSingleDate: formatSingleDate
  };
})();