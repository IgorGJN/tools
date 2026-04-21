const TASKS_SHEET_NAME = "tasks";
const USERS_SHEET_NAME = "usuarios";
const PRIVATE_TAG = "privado";

function getTasksSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET_NAME);

  if (!sheet) {
    throw new Error('A aba "tasks" não foi encontrada.');
  }

  return sheet;
}

function getUsersSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    throw new Error('A aba "usuarios" não foi encontrada.');
  }

  return sheet;
}

function ensureTaskHeaders_() {
  const sheet = getTasksSheet_();
  const headers = [
    "id",
    "title",
    "description",
    "date",
    "time",
    "endDate",
    "endTime",
    "hashtags",
    "completed",
    "createdAt",
    "updatedAt",
    "deleted",
    "deletedAt",
    "recurring",
    "recurrenceType",
    "recurrenceInterval",
    "parentTaskId",
    "owner"
  ];

  const width = Math.max(headers.length, sheet.getLastColumn() || headers.length);
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const empty = current.every(function (value) {
    return value === "";
  });

  if (empty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  headers.forEach(function (header, index) {
    const currentValue = String(current[index] || "").trim();
    if (currentValue !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  if (width > headers.length) {
    const extraHeaders = sheet.getRange(1, headers.length + 1, 1, width - headers.length).getDisplayValues()[0];
    const hasDataInExtra = extraHeaders.some(function (value) {
      return String(value || "").trim() !== "";
    });
    if (!hasDataInExtra) {
      // keep as-is; avoids deleting columns unexpectedly
    }
  }
}

function normalizeString_(value) {
  return String(value || "").trim();
}

function normalizeBool_(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function normalizeInterval_(value) {
  const num = Number(value || 1);
  if (!isFinite(num) || num < 1) {
    return 1;
  }
  return Math.floor(num);
}

function normalizeHashtagsString_(value) {
  return String(value || "")
    .split(",")
    .map(function (tag) {
      return String(tag || "").trim().replace(/^#+/, "").toLowerCase();
    })
    .filter(function (tag) {
      return tag !== "";
    })
    .filter(function (tag, index, list) {
      return list.indexOf(tag) === index;
    })
    .join(",");
}

function rowToTask_(row) {
  return {
    id: normalizeString_(row[0]),
    title: normalizeString_(row[1]),
    description: normalizeString_(row[2]),
    date: normalizeString_(row[3]),
    time: normalizeString_(row[4]),
    endDate: normalizeString_(row[5]),
    endTime: normalizeString_(row[6]),
    hashtags: normalizeHashtagsString_(row[7]),
    completed: normalizeBool_(row[8]),
    createdAt: normalizeString_(row[9]),
    updatedAt: normalizeString_(row[10]),
    deleted: normalizeBool_(row[11]),
    deletedAt: normalizeString_(row[12]),
    recurring: normalizeBool_(row[13]),
    recurrenceType: normalizeString_(row[14]),
    recurrenceInterval: normalizeInterval_(row[15]),
    parentTaskId: normalizeString_(row[16]),
    owner: normalizeString_(row[17]).toLowerCase()
  };
}

function taskToRow_(task) {
  return [
    normalizeString_(task.id),
    normalizeString_(task.title),
    normalizeString_(task.description),
    normalizeString_(task.date),
    normalizeString_(task.time),
    normalizeString_(task.endDate),
    normalizeString_(task.endTime),
    normalizeHashtagsString_(task.hashtags),
    String(normalizeBool_(task.completed)),
    normalizeString_(task.createdAt),
    normalizeString_(task.updatedAt),
    String(normalizeBool_(task.deleted)),
    normalizeString_(task.deletedAt),
    String(normalizeBool_(task.recurring)),
    normalizeString_(task.recurrenceType),
    String(normalizeInterval_(task.recurrenceInterval)),
    normalizeString_(task.parentTaskId),
    normalizeString_(task.owner).toLowerCase()
  ];
}

function getAllTasks_() {
  ensureTaskHeaders_();

  const sheet = getTasksSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 18).getDisplayValues();

  return values
    .filter(function (row) {
      return normalizeString_(row[0]) !== "";
    })
    .map(rowToTask_);
}

function replaceAllTasks_(tasks) {
  ensureTaskHeaders_();

  const sheet = getTasksSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 18).clearContent();
  }

  if (!tasks.length) {
    return;
  }

  const rows = tasks.map(taskToRow_);
  sheet.getRange(2, 1, rows.length, 18).setValues(rows);
}

function getUsers_() {
  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 7);

  if (lastRow < 2) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (value) {
    return normalizeString_(value);
  });

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  return values.map(function (row) {
    const user = {};
    headers.forEach(function (header, index) {
      user[header] = normalizeString_(row[index]);
    });

    return {
      id: normalizeString_(user.id),
      usuario: normalizeString_(user.usuario).toLowerCase(),
      senha: normalizeString_(user.senha),
      nome: normalizeString_(user.nome),
      ativo: normalizeString_(user.ativo).toLowerCase(),
      perfil: normalizeString_(user.perfil),
      updatedAt: normalizeString_(user.updated_at || user.updatedAt)
    };
  }).filter(function (user) {
    return user.usuario !== "";
  });
}

function authenticate_(username, password) {
  const user = getUsers_().find(function (item) {
    return item.usuario === normalizeString_(username).toLowerCase() && item.senha === normalizeString_(password);
  });

  if (!user) {
    throw new Error("Usuário ou senha inválidos.");
  }

  if (user.ativo !== "sim") {
    throw new Error("Acesso desativado.");
  }

  return {
    id: user.id,
    username: user.usuario,
    name: user.nome || user.usuario,
    profile: user.perfil || "user"
  };
}

function hasPrivateTag_(task) {
  const hashtags = normalizeHashtagsString_(task.hashtags).split(",").filter(Boolean);
  return hashtags.indexOf(PRIVATE_TAG) !== -1;
}

function isVisibleToUser_(task, username) {
  const owner = normalizeString_(task.owner).toLowerCase();
  const user = normalizeString_(username).toLowerCase();

  if (owner === user) {
    return true;
  }

  return !hasPrivateTag_(task);
}

function sanitizeIncomingTask_(task, username) {
  const owner = normalizeString_(task.owner).toLowerCase() || normalizeString_(username).toLowerCase();
  const now = new Date().toISOString();
  const createdAt = normalizeString_(task.createdAt) || now;
  const updatedAt = normalizeString_(task.updatedAt) || now;

  return {
    id: normalizeString_(task.id),
    title: normalizeString_(task.title),
    description: normalizeString_(task.description),
    date: normalizeString_(task.date),
    time: normalizeString_(task.time),
    endDate: normalizeString_(task.endDate),
    endTime: normalizeString_(task.endTime),
    hashtags: normalizeHashtagsString_(task.hashtags),
    completed: normalizeBool_(task.completed),
    createdAt: createdAt,
    updatedAt: updatedAt,
    deleted: normalizeBool_(task.deleted),
    deletedAt: normalizeString_(task.deletedAt),
    recurring: normalizeBool_(task.recurring),
    recurrenceType: normalizeString_(task.recurrenceType),
    recurrenceInterval: normalizeInterval_(task.recurrenceInterval),
    parentTaskId: normalizeString_(task.parentTaskId),
    owner: owner
  };
}

function successResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      message: message
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleLoginOrValidate_(body) {
  const user = authenticate_(body.username, body.password);
  return successResponse_({ success: true, user: user });
}

function handleList_(body) {
  const user = authenticate_(body.username, body.password);
  const visibleTasks = getAllTasks_().filter(function (task) {
    return isVisibleToUser_(task, user.username);
  });

  return successResponse_({
    success: true,
    user: user,
    tasks: visibleTasks
  });
}

function handleSync_(body) {
  const user = authenticate_(body.username, body.password);
  const incomingTasks = Array.isArray(body.tasks) ? body.tasks : [];
  const remoteTasks = getAllTasks_();
  const mergedMap = {};

  remoteTasks.forEach(function (task) {
    mergedMap[task.id] = task;
  });

  incomingTasks.forEach(function (task) {
    const sanitized = sanitizeIncomingTask_(task, user.username);
    if (!sanitized.id) {
      return;
    }

    if (sanitized.owner !== user.username) {
      return;
    }

    const current = mergedMap[sanitized.id];

    if (!current) {
      mergedMap[sanitized.id] = sanitized;
      return;
    }

    if (normalizeString_(current.owner).toLowerCase() !== user.username) {
      return;
    }

    const currentTime = new Date(current.updatedAt || 0).getTime();
    const incomingTime = new Date(sanitized.updatedAt || 0).getTime();

    if (incomingTime >= currentTime) {
      mergedMap[sanitized.id] = sanitized;
    }
  });

  const mergedTasks = Object.keys(mergedMap).map(function (key) {
    return mergedMap[key];
  }).sort(function (a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });

  replaceAllTasks_(mergedTasks);

  const visibleTasks = mergedTasks.filter(function (task) {
    return isVisibleToUser_(task, user.username);
  });

  return successResponse_({
    success: true,
    user: user,
    tasks: visibleTasks
  });
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "health";

    if (action === "health") {
      return successResponse_({ success: true, message: "ok" });
    }

    return errorResponse_("Ação GET inválida.");
  } catch (error) {
    return errorResponse_(error.message);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = body.action || "";

    if (action === "login" || action === "validateSession") {
      return handleLoginOrValidate_(body);
    }

    if (action === "list") {
      return handleList_(body);
    }

    if (action === "sync") {
      return handleSync_(body);
    }

    return errorResponse_("Ação POST inválida.");
  } catch (error) {
    return errorResponse_(error.message);
  }
}
