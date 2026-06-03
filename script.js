const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_HOURS = 8;
const EXTENDED_HOURS = 2;
const REGULAR_LIMIT = 40;
const TIME_AND_HALF_LIMIT = 50;
const MAX_WEEKLY_HOURS = 58;
const NIGHT_SHIFT_MULTIPLIER = 1.16;
const SAVED_GRID_COLUMNS = "42px 42px 96px 54px repeat(7, 116px) 100px 100px 108px 86px 78px 78px 108px 280px";

const state = DAYS.map(() => ({ worked: false, shift: "morning", extended: false }));
const savedRecords = [];
let selectedSavedRecordId = null;

const grid = document.querySelector("#schedule-grid");
const template = document.querySelector("#day-card-template");
const baseRateInput = document.querySelector("#base-rate");
const rollingWeekInput = document.querySelector("#rolling-week");
const saveButton = document.querySelector("#save-schedule");
const resetButton = document.querySelector("#reset-schedule");
const deleteSavedButton = document.querySelector("#delete-saved");
const validationList = document.querySelector("#validation-list");
const totalHoursOutput = document.querySelector("#total-hours");
const paidHoursOutput = document.querySelector("#paid-hours");
const totalPayOutput = document.querySelector("#total-pay");
const breakdownOutput = document.querySelector("#breakdown");
const savedRecordsSection = document.querySelector(".saved-records");
const savedRecordsBody = document.querySelector("#saved-records-body");
const savedRecordsEmpty = document.querySelector("#saved-records-empty");
const savedRecordsCount = document.querySelector("#saved-records-count");

function formatHours(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDayHours(day) {
  if (!day.worked) {
    return 0;
  }

  return SHIFT_HOURS + (day.extended ? EXTENDED_HOURS : 0);
}

function getOvertimeMultiplier(hourIndex) {
  if (hourIndex >= TIME_AND_HALF_LIMIT) {
    return 2;
  }

  if (hourIndex >= REGULAR_LIMIT) {
    return 1.5;
  }

  return 1;
}

function calculatePay(days, baseRate) {
  let workedHoursSoFar = 0;
  let regularHours = 0;
  let timeAndHalfHours = 0;
  let doubleTimeHours = 0;
  let nightPremiumHours = 0;
  let paidHours = 0;
  let totalPay = 0;

  days.forEach((day) => {
    const dayHours = getDayHours(day);

    if (dayHours === 0) {
      return;
    }

    const shiftMultiplier = day.shift === "night" ? NIGHT_SHIFT_MULTIPLIER : 1;

    if (day.shift === "night") {
      nightPremiumHours += dayHours;
    }

    let remainingDayHours = dayHours;

    while (remainingDayHours > 0) {
      const overtimeMultiplier = getOvertimeMultiplier(workedHoursSoFar);
      const tierEnd = overtimeMultiplier === 1 ? REGULAR_LIMIT : overtimeMultiplier === 1.5 ? TIME_AND_HALF_LIMIT : Infinity;
      const chunkHours = Math.min(remainingDayHours, tierEnd - workedHoursSoFar);
      const paidHourMultiplier = overtimeMultiplier * shiftMultiplier;

      if (overtimeMultiplier === 1) {
        regularHours += chunkHours;
      } else if (overtimeMultiplier === 1.5) {
        timeAndHalfHours += chunkHours;
      } else {
        doubleTimeHours += chunkHours;
      }

      paidHours += chunkHours * paidHourMultiplier;
      totalPay += chunkHours * baseRate * paidHourMultiplier;
      workedHoursSoFar += chunkHours;
      remainingDayHours -= chunkHours;
    }
  });

  return {
    totalHours: workedHoursSoFar,
    regularHours,
    timeAndHalfHours,
    doubleTimeHours,
    nightPremiumHours,
    paidHours,
    totalPay: roundCurrency(totalPay),
  };
}

function findLongestWorkStreak() {
  let longest = 0;
  let current = 0;

  state.forEach((day) => {
    if (day.worked) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  });

  return longest;
}

function findShiftSequenceErrors(rollingWeekEnabled) {
  const errors = [];
  const dayPairs = DAYS.slice(0, -1).map((_, index) => [index, index + 1]);

  if (rollingWeekEnabled) {
    dayPairs.push([DAYS.length - 1, 0]);
  }

  dayPairs.forEach(([currentIndex, nextIndex]) => {
    const current = state[currentIndex];
    const next = state[nextIndex];

    if (current.worked && next.worked && current.shift === "night" && next.shift === "morning") {
      errors.push(`${DAYS[currentIndex]} night shift cannot be followed by ${DAYS[nextIndex]} morning shift.`);
    }
  });

  return errors;
}

function validateSchedule(totalHours) {
  const messages = [];
  const baseRate = Number(baseRateInput.value);
  const longestStreak = findLongestWorkStreak();
  const shiftSequenceErrors = findShiftSequenceErrors(rollingWeekInput.checked);

  if (!Number.isFinite(baseRate) || baseRate < 0) {
    messages.push({ valid: false, text: "Base rate must be zero or greater." });
  }

  if (longestStreak > 6) {
    messages.push({ valid: false, text: "No more than 6 consecutive days can be worked in the Sunday–Saturday pay week." });
  }

  if (totalHours > MAX_WEEKLY_HOURS) {
    messages.push({ valid: false, text: `Weekly working hours cannot exceed ${MAX_WEEKLY_HOURS}.` });
  }

  shiftSequenceErrors.forEach((text) => messages.push({ valid: false, text }));

  if (messages.length === 0) {
    messages.push({ valid: true, text: "Schedule is valid and ready to calculate." });
  }

  return messages;
}

function cloneSchedule(days) {
  return days.map((day) => ({ ...day }));
}

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSavedRecord(pay, validationMessages) {
  return {
    id: createRecordId(),
    baseRate: Math.max(Number(baseRateInput.value) || 0, 0),
    rollingWeek: rollingWeekInput.checked,
    schedule: cloneSchedule(state),
    pay: { ...pay },
    validationMessages: validationMessages.map((message) => ({ ...message })),
    selectedForDelete: false,
  };
}

function getDaySummary(day) {
  if (!day.worked) {
    return "Off";
  }

  const shiftLabel = day.shift === "night" ? "N" : "M";
  const extendedLabel = day.extended ? " Ext" : "";

  return `${shiftLabel}${extendedLabel} (${formatHours(getDayHours(day))}h)`;
}

function getValidationSummary(messages) {
  return messages.map((message) => message.text).join(" | ");
}

function populateSchedule(record) {
  baseRateInput.value = record.baseRate.toFixed(2);
  rollingWeekInput.checked = record.rollingWeek;
  record.schedule.forEach((day, index) => {
    state[index].worked = day.worked;
    state[index].shift = day.shift;
    state[index].extended = day.extended;
  });
  update();
}

function selectSavedRecord(record) {
  selectedSavedRecordId = record.id;
  populateSchedule(record);
  renderSavedRecords();
}

function selectSavedRecordById(recordId) {
  const record = savedRecords.find((savedRecord) => savedRecord.id === recordId);

  if (record) {
    selectSavedRecord(record);
  }
}

function addGridCell(row, text, className = "") {
  const cell = document.createElement("div");
  cell.className = className;
  cell.setAttribute("role", "gridcell");
  cell.textContent = text;
  row.appendChild(cell);
}

function renderSavedRecords() {
  savedRecordsBody.replaceChildren();
  savedRecordsEmpty.style.display = savedRecords.length > 0 ? "none" : "block";
  savedRecordsCount.textContent = savedRecords.length === 0 ? "" : `${savedRecords.length} saved schedule${savedRecords.length === 1 ? "" : "s"}.`;
  deleteSavedButton.disabled = !savedRecords.some((record) => record.selectedForDelete);

  savedRecords.forEach((record, recordIndex) => {
    const row = document.createElement("div");
    const selectCell = document.createElement("div");
    const deleteCell = document.createElement("div");
    const deleteCheckbox = document.createElement("input");
    const isSelected = record.id === selectedSavedRecordId;

    row.className = `saved-grid-row${isSelected ? " is-selected" : ""}`;
    row.style.display = "grid";
    row.style.gridTemplateColumns = SAVED_GRID_COLUMNS;
    row.dataset.recordId = record.id;
    row.setAttribute("role", "row");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-selected", String(isSelected));

    selectCell.className = "saved-grid-control saved-grid-select-indicator";
    selectCell.setAttribute("role", "gridcell");
    selectCell.textContent = isSelected ? "✓" : "";

    deleteCell.className = "saved-grid-control";
    deleteCell.setAttribute("role", "gridcell");
    deleteCheckbox.type = "checkbox";
    deleteCheckbox.checked = record.selectedForDelete;
    deleteCheckbox.setAttribute("aria-label", `Select saved schedule ${recordIndex + 1} for deletion`);
    deleteCheckbox.addEventListener("click", (event) => event.stopPropagation());
    deleteCheckbox.addEventListener("keydown", (event) => event.stopPropagation());
    deleteCheckbox.addEventListener("change", () => {
      record.selectedForDelete = deleteCheckbox.checked;
      renderSavedRecords();
    });
    deleteCell.appendChild(deleteCheckbox);

    row.appendChild(selectCell);
    row.appendChild(deleteCell);

    const cells = [
      formatMoney(record.baseRate),
      record.rollingWeek ? "On" : "Off",
      ...record.schedule.map(getDaySummary),
      formatHours(record.pay.totalHours),
      formatHours(record.pay.paidHours),
      formatMoney(record.pay.totalPay),
      formatHours(record.pay.regularHours),
      formatHours(record.pay.timeAndHalfHours),
      formatHours(record.pay.doubleTimeHours),
      formatHours(record.pay.nightPremiumHours),
      getValidationSummary(record.validationMessages),
    ];

    cells.forEach((cellText, cellIndex) => {
      const isDayCell = cellIndex >= 2 && cellIndex <= 8;
      const isNumericCell = cellIndex >= 9 && cellIndex <= 14;
      const isValidationCell = cellIndex === cells.length - 1;
      const className = isValidationCell ? "validation-cell" : isDayCell ? "day-cell" : isNumericCell ? "numeric-cell" : "";
      addGridCell(row, cellText, className);
    });

    savedRecordsBody.appendChild(row);
  });
}

function renderValidation(messages) {
  validationList.replaceChildren();

  messages.forEach((message) => {
    const item = document.createElement("li");
    item.className = message.valid ? "valid" : "invalid";
    item.textContent = message.text;
    validationList.append(item);
  });
}

function renderScheduleCards() {
  grid.replaceChildren();

  state.forEach((day, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const workedInput = card.querySelector(".worked-input");
    const shiftInputs = card.querySelectorAll(".shift-input");
    const extendInput = card.querySelector(".extend-input");
    const dayName = card.querySelector(".day-name");
    const dayHours = card.querySelector(".day-hours");

    card.classList.toggle("is-worked", day.worked);
    dayName.textContent = DAYS[index];
    workedInput.checked = day.worked;
    workedInput.setAttribute("aria-label", `Work on ${DAYS[index]}`);
    extendInput.checked = day.extended;
    extendInput.disabled = !day.worked;
    extendInput.setAttribute("aria-label", `Extend ${DAYS[index]} shift by 2 hours`);
    dayHours.textContent = `${formatHours(getDayHours(day))} hours`;

    shiftInputs.forEach((input) => {
      input.name = `shift-${index}`;
      input.checked = input.value === day.shift;
      input.disabled = !day.worked;
      input.setAttribute("aria-label", `${DAYS[index]} ${input.value} shift`);
      input.addEventListener("change", () => {
        state[index].shift = input.value;
        update();
      });
    });

    workedInput.addEventListener("change", () => {
      state[index].worked = workedInput.checked;
      update();
    });

    extendInput.addEventListener("change", () => {
      state[index].extended = extendInput.checked;
      update();
    });

    grid.append(card);
  });
}

function update() {
  const baseRate = Math.max(Number(baseRateInput.value) || 0, 0);
  const pay = calculatePay(state, baseRate);
  const validationMessages = validateSchedule(pay.totalHours);

  totalHoursOutput.textContent = formatHours(pay.totalHours);
  paidHoursOutput.textContent = formatHours(pay.paidHours);
  totalPayOutput.textContent = formatMoney(pay.totalPay);
  breakdownOutput.textContent = `${formatHours(pay.regularHours)} regular hours, ${formatHours(pay.timeAndHalfHours)} hours at 1.5×, ${formatHours(pay.doubleTimeHours)} hours at 2×, and ${formatHours(pay.nightPremiumHours)} night-shift hours with a 16% premium.`;

  renderScheduleCards();
  renderValidation(validationMessages);

  return { pay, validationMessages };
}

savedRecordsBody.addEventListener("click", (event) => {
  if (event.target.closest('input[type="checkbox"]')) {
    return;
  }

  const row = event.target.closest(".saved-grid-row");

  if (row?.dataset.recordId) {
    selectSavedRecordById(row.dataset.recordId);
  }
});

savedRecordsBody.addEventListener("keydown", (event) => {
  if (event.target.closest('input[type="checkbox"]')) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const row = event.target.closest(".saved-grid-row");

  if (row?.dataset.recordId) {
    event.preventDefault();
    selectSavedRecordById(row.dataset.recordId);
  }
});

saveButton.addEventListener("click", () => {
  const { pay, validationMessages } = update();
  savedRecords.push(createSavedRecord(pay, validationMessages));
  renderSavedRecords();
  savedRecordsSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

deleteSavedButton.addEventListener("click", () => {
  for (let index = savedRecords.length - 1; index >= 0; index -= 1) {
    if (savedRecords[index].selectedForDelete) {
      if (savedRecords[index].id === selectedSavedRecordId) {
        selectedSavedRecordId = null;
      }
      savedRecords.splice(index, 1);
    }
  }
  renderSavedRecords();
});

resetButton.addEventListener("click", () => {
  state.forEach((day) => {
    day.worked = false;
    day.shift = "morning";
    day.extended = false;
  });
  update();
});

baseRateInput.addEventListener("input", update);
rollingWeekInput.addEventListener("change", update);

update();
renderSavedRecords();
