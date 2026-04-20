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

  function formatDate(date, time) {
    if (!date) {
      return "";
    }

    const parts = date.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const baseDate = new Date(year, month, day);

    const formatted = baseDate.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });

    if (time) {
      return formatted + " • " + time;
    }

    return formatted;
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
        '<span class="tag-chip">Nenhuma hashtag cadastrada</span>';
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
      html += "</div>";

      html += '<div class="task-tags">';

      if (task.hashtags && task.hashtags.length) {
        task.hashtags.forEach(function (tag) {
          html +=
            '<button class="tag-chip" type="button" data-tag="' +
            escapeHtml(tag) +
            '">#' +
            escapeHtml(tag) +
            "</button>";
        });
      } else {
        html += '<span class="tag-chip">Sem hashtags</span>';
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
    showToast: showToast
  };
})();