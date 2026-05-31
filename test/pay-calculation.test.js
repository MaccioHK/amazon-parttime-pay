const test = require("node:test");
const assert = require("node:assert/strict");

const REGULAR_LIMIT = 40;
const TIME_AND_HALF_LIMIT = 50;

function calculatePay(totalHours, baseRate) {
  const regularHours = Math.min(totalHours, REGULAR_LIMIT);
  const timeAndHalfHours = Math.min(Math.max(totalHours - REGULAR_LIMIT, 0), TIME_AND_HALF_LIMIT - REGULAR_LIMIT);
  const doubleTimeHours = Math.max(totalHours - TIME_AND_HALF_LIMIT, 0);
  const paidHours = regularHours + timeAndHalfHours * 1.5 + doubleTimeHours * 2;
  const totalPay = paidHours * baseRate;

  return { regularHours, timeAndHalfHours, doubleTimeHours, paidHours, totalPay };
}

test("pays regular hours up to 40", () => {
  assert.deepEqual(calculatePay(32, 20), {
    regularHours: 32,
    timeAndHalfHours: 0,
    doubleTimeHours: 0,
    paidHours: 32,
    totalPay: 640,
  });
});

test("pays hours above 40 and up to 50 at 1.5x", () => {
  assert.deepEqual(calculatePay(50, 20), {
    regularHours: 40,
    timeAndHalfHours: 10,
    doubleTimeHours: 0,
    paidHours: 55,
    totalPay: 1100,
  });
});

test("pays hours above 50 at 2x", () => {
  assert.deepEqual(calculatePay(58, 20), {
    regularHours: 40,
    timeAndHalfHours: 10,
    doubleTimeHours: 8,
    paidHours: 71,
    totalPay: 1420,
  });
});
