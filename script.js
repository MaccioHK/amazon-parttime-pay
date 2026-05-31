const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_HOURS = 8;
const EXTENDED_HOURS = 2;
const REGULAR_LIMIT = 40;
const TIME_AND_HALF_LIMIT = 50;
const MAX_WEEKLY_HOURS = 58;

const state = DAYS.map(() => ({ worked: false, shift: "morning", extended: false }));

const grid = document.querySelector("#schedule-grid");
const template = document.querySelector("#day-card-template");
const baseRateInput = document.querySelector("#base-rate");
const resetButton = document.querySelector("#reset-schedule");
const validationList = document.querySelector("#validation-list");
const totalHoursOutput = document.querySelector("#total-hours");
const paidHoursOutput = document.querySelector("#paid-hours");
const totalPayOutput = document.querySelector("#total-pay");
const breakdownOutput = document.querySelector("#breakdown");

function formatHours(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getDayHours(day) {
  if (!day.worked) {
    return 0;
  }

  return SHIFT_HOURS + (day.extended ? EXTENDED_HOURS : 0);
}

function calculatePay(totalHours, baseRate) {
  const regularHours = Math.min(totalHours, REGULAR_LIMIT);
  const timeAndHalfHours = Math.min(Math.max(totalHours - REGULAR_LIMIT, 0), TIME_AND_HALF_LIMIT - REGULAR_LIMIT);
  const doubleTimeHours = Math.max(totalHours - TIME_AND_HALF_LIMIT, 0);
  const paidHours = regularHours + timeAndHalfHours * 1.5 + doubleTimeHours * 2;
  const totalPay = paidHours * baseRate;

  return { regularHours, timeAndHalfHours, doubleTimeHours, paidHours, totalPay };
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

function findShiftSequenceErrors() {
  const errors = [];

  for (let index = 0; index < state.length - 1; index += 1) {
    const current = state[index];
    const next = state[index + 1];

    if (current.worked && next.worked && current.shift === "night" && next.shift === "morning") {
      errors.push(`${DAYS[index]} night shift cannot be followed by ${DAYS[index + 1]} morning shift.`);
    }
  }

  return errors;
}

function validateSchedule(totalHours) {
  const messages = [];
  const baseRate = Number(baseRateInput.value);
  const longestStreak = findLongestWorkStreak();
  const shiftSequenceErrors = findShiftSequenceErrors();

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
  const totalHours = state.reduce((sum, day) => sum + getDayHours(day), 0);
  const baseRate = Math.max(Number(baseRateInput.value) || 0, 0);
  const pay = calculatePay(totalHours, baseRate);
  const validationMessages = validateSchedule(totalHours);

  totalHoursOutput.textContent = formatHours(totalHours);
  paidHoursOutput.textContent = formatHours(pay.paidHours);
  totalPayOutput.textContent = formatMoney(pay.totalPay);
  breakdownOutput.textContent = `${formatHours(pay.regularHours)} regular hours, ${formatHours(pay.timeAndHalfHours)} hours at 1.5×, and ${formatHours(pay.doubleTimeHours)} hours at 2×.`;

  renderScheduleCards();
  renderValidation(validationMessages);
}

resetButton.addEventListener("click", () => {
  state.forEach((day) => {
    day.worked = false;
    day.shift = "morning";
    day.extended = false;
  });
  update();
});

baseRateInput.addEventListener("input", update);

update();
