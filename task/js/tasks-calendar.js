const TaskCalendar = (function () {
  const refs = {
    calendarTitle: document.getElementById("calendarTitle"),
    calendarGrid: document.getElementById("calendarGrid"),
    prevMonthBtn: document.getElementById("prevMonthBtn"),
    nextMonthBtn: document.getElementById("nextMonthBtn"),
    clearDateFilterBtn: document.getElementById("clearDateFilterBtn")
  };

  const state = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: ""
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISO(date) {
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate())
    );
  }

  function parseISO(dateString) {
    const parts = String(dateString || "").split("-");
    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(year, month, day);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getMonthLabel(month, year) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });
  }

  function buildCalendarDays(month, year) {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const firstVisibleDay = new Date(year, month, 1 - startDayOfWeek);

    const days = [];

    for (let i = 0; i < 42; i += 1) {
      const date = new Date(firstVisibleDay);
      date.setDate(firstVisibleDay.getDate() + i);

      days.push({
        date: date,
        iso: toISO(date),
        inCurrentMonth: date.getMonth() === month
      });
    }

    return days;
  }

  function getTasksByDate(tasks) {
    const map = {};

    tasks.forEach(function (task) {
      if (task.deleted || !task.date) {
        return;
      }

      if (!map[task.date]) {
        map[task.date] = [];
      }

      map[task.date].push(task);
    });

    return map;
  }

  function sortDayTasks(tasks) {
    return tasks.slice().sort(function (a, b) {
      const timeA = String(a.time || "23:59");
      const timeB = String(b.time || "23:59");
      return timeA.localeCompare(timeB);
    });
  }

  function render(tasks) {
    if (!refs.calendarGrid || !refs.calendarTitle) {
      return;
    }

    const today = toISO(new Date());
    const tasksByDate = getTasksByDate(tasks);
    const days = buildCalendarDays(state.currentMonth, state.currentYear);

    refs.calendarTitle.textContent = getMonthLabel(state.currentMonth, state.currentYear);

    let html = "";

    days.forEach(function (item) {
      const rawDayTasks = tasksByDate[item.iso] || [];
      const dayTasks = sortDayTasks(rawDayTasks);
      const hasOverdue = dayTasks.some(function (task) {
        return !task.completed && task.date < today;
      });

      html += '<button type="button" class="calendar-day';

      if (!item.inCurrentMonth) {
        html += " outside-month";
      }

      if (item.iso === today) {
        html += " today";
      }

      if (item.iso === state.selectedDate) {
        html += " selected";
      }

      if (hasOverdue) {
        html += " has-overdue";
      }

      html += '" data-date="' + item.iso + '">';

      html += '<div class="calendar-day-top">';
      html += '<span class="calendar-day-number">' + item.date.getDate() + "</span>";

      if (dayTasks.length > 0) {
        html += '<span class="calendar-day-count">' + dayTasks.length + "</span>";
      } else {
        html += '<span class="calendar-day-count calendar-empty">-</span>';
      }

      html += "</div>";

      html += '<div class="calendar-day-items">';

      if (dayTasks.length > 0) {
        dayTasks.slice(0, 2).forEach(function (task) {
          html += '<div class="calendar-task-line">';
          html += '<span class="calendar-task-title">' + escapeHtml(task.title) + "</span>";
          html += "</div>";
        });

        if (dayTasks.length > 2) {
          html +=
            '<div class="calendar-more">+' +
            (dayTasks.length - 2) +
            " mais</div>";
        }
      } else {
        html += '<div class="calendar-empty">Sem tarefas</div>';
      }

      html += "</div>";

      html += '<div class="calendar-dots">';

      if (dayTasks.length > 0) {
        dayTasks.slice(0, 5).forEach(function (task) {
          let dotClass = "calendar-dot";

          if (task.completed) {
            dotClass += " completed";
          } else if (task.date < today) {
            dotClass += " overdue";
          }

          html += '<span class="' + dotClass + '"></span>';
        });
      }

      html += "</div>";
      html += "</button>";
    });

    refs.calendarGrid.innerHTML = html;
  }

  function setSelectedDate(dateString) {
    state.selectedDate = dateString || "";
  }

  function getSelectedDate() {
    return state.selectedDate;
  }

  function goToPreviousMonth() {
    state.currentMonth -= 1;

    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear -= 1;
    }
  }

  function goToNextMonth() {
    state.currentMonth += 1;

    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear += 1;
    }
  }

  function bindEvents(onDateSelect, onClear) {
    if (refs.prevMonthBtn) {
      refs.prevMonthBtn.addEventListener("click", function () {
        goToPreviousMonth();
        onDateSelect(null, false);
      });
    }

    if (refs.nextMonthBtn) {
      refs.nextMonthBtn.addEventListener("click", function () {
        goToNextMonth();
        onDateSelect(null, false);
      });
    }

    if (refs.clearDateFilterBtn) {
      refs.clearDateFilterBtn.addEventListener("click", function () {
        state.selectedDate = "";
        onClear();
      });
    }

    if (refs.calendarGrid) {
      refs.calendarGrid.addEventListener("click", function (event) {
        const button = event.target.closest(".calendar-day");

        if (!button) {
          return;
        }

        const date = button.dataset.date || "";
        state.selectedDate = date;

        const parsed = parseISO(date);
        if (parsed) {
          state.currentMonth = parsed.getMonth();
          state.currentYear = parsed.getFullYear();
        }

        onDateSelect(date, true);
      });
    }
  }

  return {
    render: render,
    bindEvents: bindEvents,
    setSelectedDate: setSelectedDate,
    getSelectedDate: getSelectedDate
  };
})();