const test = require("node:test");
const assert = require("node:assert/strict");

const SHIFT_HOURS = 8;
const EXTENDED_HOURS = 2;
const REGULAR_LIMIT = 40;
const TIME_AND_HALF_LIMIT = 50;
const NIGHT_SHIFT_MULTIPLIER = 1.16;

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

function day(worked = true, shift = "morning", extended = false) {
  return { worked, shift, extended };
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
