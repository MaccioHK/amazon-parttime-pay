# amazon-parttime-pay

A small browser-based calculator for estimating Amazon part-time weekly income.

## Features

- Calculates pay on a fixed Sunday-to-Saturday pay week.
- Accepts a base hourly rate and a daily schedule with morning/night shift indicators.
- Counts each morning or night shift as 8 working hours.
- Adds 2 working hours when the extended-shift indicator is selected.
- Applies a 16% pay premium to night-shift hours, including extended hours only when the night shift is selected.
- Validates the weekly schedule:
  - maximum 6 consecutive worked days in the displayed pay week,
  - night shifts cannot be followed by morning shifts on the next day,
  - maximum 58 working hours per week.
- Shows total working hours, weighted paid hours, and total pay.

## Overtime rules

- 0–40 weekly hours are paid at the base rate.
- Night-shift hours are paid 16% more, including extended hours on night shifts.
- Hours above 40 and up to 50 are paid at 1.5×.
- Hours above 50 are paid at 2×.

## Run locally

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 4173
```

Then visit <http://127.0.0.1:4173>.

## Test

```bash
npm test
```
