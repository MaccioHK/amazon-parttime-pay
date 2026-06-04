const test = require("node:test");
const assert = require("node:assert/strict");

const DEFAULT_SHIFT_HOURS = 8;
const MIN_SHIFT_HOURS = 1;
const MAX_SHIFT_HOURS = 10;
const EXTENDED_HOURS = 2;
const REGULAR_LIMIT = 40;
const TIME_AND_HALF_LIMIT = 50;
const NIGHT_SHIFT_MULTIPLIER = 1.16;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getDayHours(day) {
  if (!day.worked) {
    return 0;
  }

  return day.hours + (day.extended ? EXTENDED_HOURS : 0);
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

function day(worked = true, shift = "morning", extended = false, hours = DEFAULT_SHIFT_HOURS) {
  return { worked, shift, hours, extended };
}

function cloneSchedule(days) {
  return days.map((dayEntry) => ({ ...dayEntry }));
}

function createSavedRecordSnapshot(schedule, pay, validationMessages) {
  return {
    schedule: cloneSchedule(schedule),
    pay: { ...pay },
    validationMessages: validationMessages.map((message) => ({ ...message })),
    selectedForDelete: false,
  };
}

function findShiftSequenceErrors(days, rollingWeekEnabled) {
  const errors = [];
  const dayPairs = DAYS.slice(0, -1).map((_, index) => [index, index + 1]);

  if (rollingWeekEnabled) {
    dayPairs.push([DAYS.length - 1, 0]);
  }

  dayPairs.forEach(([currentIndex, nextIndex]) => {
    const current = days[currentIndex];
    const next = days[nextIndex];

    if (current.worked && next.worked && current.shift === "night" && next.shift === "morning") {
      errors.push(`${DAYS[currentIndex]} night shift cannot be followed by ${DAYS[nextIndex]} morning shift.`);
    }
  });

  return errors;
}

test("pays regular morning hours up to 40", () => {
  assert.deepEqual(calculatePay([day(), day(), day(), day()], 20), {
    totalHours: 32,
    regularHours: 32,
    timeAndHalfHours: 0,
    doubleTimeHours: 0,
    nightPremiumHours: 0,
    paidHours: 32,
    totalPay: 640,
  });
});

test("pays hours above 40 and up to 50 at 1.5x", () => {
  assert.deepEqual(calculatePay([day(true, "morning", true), day(true, "morning", true), day(true, "morning", true), day(true, "morning", true), day(true, "morning", true)], 20), {
    totalHours: 50,
    regularHours: 40,
    timeAndHalfHours: 10,
    doubleTimeHours: 0,
    nightPremiumHours: 0,
    paidHours: 55,
    totalPay: 1100,
  });
});

test("pays hours above 50 at 2x", () => {
  assert.deepEqual(calculatePay([day(true, "morning", true), day(true, "morning", true), day(true, "morning", true), day(true, "morning", true), day(true, "morning", true), day()], 20), {
    totalHours: 58,
    regularHours: 40,
    timeAndHalfHours: 10,
    doubleTimeHours: 8,
    nightPremiumHours: 0,
    paidHours: 71,
    totalPay: 1420,
  });
});

test("pays night shift and night extended hours with a 16 percent premium", () => {
  assert.deepEqual(calculatePay([day(true, "night", true)], 20), {
    totalHours: 10,
    regularHours: 10,
    timeAndHalfHours: 0,
    doubleTimeHours: 0,
    nightPremiumHours: 10,
    paidHours: 11.6,
    totalPay: 232,
  });
});

test("does not apply the night premium to morning extended hours", () => {
  assert.deepEqual(calculatePay([day(true, "morning", true)], 20), {
    totalHours: 10,
    regularHours: 10,
    timeAndHalfHours: 0,
    doubleTimeHours: 0,
    nightPremiumHours: 0,
    paidHours: 10,
    totalPay: 200,
  });
});


test("keeps Saturday night to Sunday morning valid when rolling week is off", () => {
  const schedule = [day(true, "morning"), day(false), day(false), day(false), day(false), day(false), day(true, "night")];

  assert.deepEqual(findShiftSequenceErrors(schedule, false), []);
});

test("flags Saturday night followed by Sunday morning when rolling week is on", () => {
  const schedule = [day(true, "morning"), day(false), day(false), day(false), day(false), day(false), day(true, "night")];

  assert.deepEqual(findShiftSequenceErrors(schedule, true), [
    "Saturday night shift cannot be followed by Sunday morning shift.",
  ]);
});


test("saved record snapshots keep an independent copy of the weekly schedule", () => {
  const schedule = [day(true, "night", true), day(false)];
  const pay = calculatePay(schedule, 20);
  const record = createSavedRecordSnapshot(schedule, pay, [{ valid: true, text: "Schedule is valid and ready to calculate." }]);

  schedule[0].shift = "morning";
  schedule[0].extended = false;

  assert.deepEqual(record.schedule[0], { worked: true, shift: "night", hours: 8, extended: true });
  assert.equal(record.pay.totalHours, 10);
  assert.equal(record.selectedForDelete, false);
});


test("uses selected hours instead of shift type for daily hours", () => {
  assert.equal(getDayHours(day(true, "morning", false, 6)), 6);
  assert.equal(getDayHours(day(true, "night", false, 6)), 6);
  assert.equal(getDayHours(day(true, "night", true, 6)), 8);
});


test("selected hours support the 1 to 10 dropdown range while defaulting to 8", () => {
  assert.equal(MIN_SHIFT_HOURS, 1);
  assert.equal(DEFAULT_SHIFT_HOURS, 8);
  assert.equal(MAX_SHIFT_HOURS, 10);
  assert.equal(getDayHours(day(true, "morning", false, MAX_SHIFT_HOURS)), 10);
});
