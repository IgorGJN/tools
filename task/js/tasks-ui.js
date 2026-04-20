const TaskUI = (function () {
  const elements = {
    totalTasks: document.getElementById("totalTasks"),
    pendingTasks: document.getElementById("pendingTasks"),
    completedTasks: document.getElementById("completedTasks"),
    overdueTasks: document.getElementById("overdueTasks"),
    taskList: document.getElementById("taskList"),
    upcomingList: document.getElementById("upcomingList"),
    emptyState: document.getElementById("emptyState"),
    hashtagsPanel: document.getElementById("hashtagsPanel"),
    taskCountLabel: document.getElementById("taskCountLabel"),
    toastContainer: document.getElementById("toastContainer")
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

  function formatDate(date, time) {
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

  function formatRecurrence(task) {
    if (!task || task.recurring !== true) {
      return "";
    }

    const interval = Number(task.recurrenceInterval || 1);

    if (task.recurrenceType === "daily") {
      return interval === 1 ? "Recorrente • todo dia" : "Recorrente • a cada " + interval + " dias";
    }

    if (task.recurrenceType === "weekly") {
      return interval === 1 ? "Recorrente • toda semana" : "Recorrente • a cada " + interval + " semanas";
    }

    if (task.recurrenceType === "monthly") {
      return interval === 1 ? "Recorrente • todo mês" : "Recorrente • a cada " + interval + " meses";
    }

    if (task.recurrenceType === "yearly") {
      return interval === 1 ? "Recorrente • todo ano" : "Recorrente • a cada " + interval + " anos";
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

  function renderSummary(summary) {
    elements.totalTasks.textContent = summary.total;
    elements.pendingTasks.textContent = summary.pending;
    elements.completedTasks.textContent = summary.completed;
    elements.overdueTasks.textContent = summary.overdue;
  }

  function renderHashtags(tags, activeTag) {
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

  function renderTasks(tasks) {
    elements.taskCountLabel.textContent =
      tasks.length + " " + (tasks.length === 1 ? "item" : "itens");

    if (!tasks.length) {
      elements.taskList.innerHTML = "";
      elements.emptyState.classList.remove("hidden");
      return;
    }

    elements.emptyState.classList.add("hidden");

    let html = "";

    tasks.forEach(function (task) {
      const status = TaskStore.getStatus(task);
      const meta = statusMeta(status);
      const recurrenceText = formatRecurrence(task);

      html += '<article class="task-card ' + meta.cardClass;
      if (task.completed) {
        html += " completed";
      }
      html += '">';

      html += '<div class="task-top">';
      html += '<div class="task-title-wrap">';

      html +=
        '<input class="task-check" type="checkbox" data-action="toggle" data-id="' +
        task.id +
        '"' +
        (task.completed ? " checked" : "") +
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
        '">Editar</button>';
      html +=
        '<button class="action-btn" type="button" data-action="delete" data-id="' +
        task.id +
        '">Excluir</button>';
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
        escapeHtml(formatDate(task.date, task.time)) +
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
    });

    elements.taskList.innerHTML = html;
  }

  function renderUpcoming(tasks) {
    if (!tasks.length) {
      elements.upcomingList.innerHTML =
        '<div class="upcoming-card"><p class="task-description">Nenhuma tarefa pendente.</p></div>';
      return;
    }

    let html = "";

    tasks.forEach(function (task) {
      html += '<article class="upcoming-card">';
      html += '<h3 class="upcoming-title">' + escapeHtml(task.title) + "</h3>";
      html +=
        '<div class="upcoming-date">' +
        escapeHtml(formatDate(task.date, task.time)) +
        "</div>";
      html += "</article>";
    });

    elements.upcomingList.innerHTML = html;
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
    renderUpcoming: renderUpcoming,
    showToast: showToast,
    normalizeDate: normalizeDate,
    normalizeTime: normalizeTime
  };
})();