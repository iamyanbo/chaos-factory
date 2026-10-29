import { expect, test } from 'vitest';
import { ComboWindow } from '../../apps/show/src/kit/hype/combo-window';

test('a smaller simultaneous entrant combo does not flicker over a larger earned combo', () => {
  const display = new ComboWindow();
  display.add(0, 12);
  display.add(.1, 2);
  expect(display.value(.1)).toBe(12);
});

test('continued smaller combos cannot keep another entrants old peak alive', () => {
  const display = new ComboWindow();
  display.add(0, 12);
  display.add(.8, 2);
  expect(display.value(1.01)).toBe(2);
  expect(display.value(1.8)).toBe(0);
});

test('the next round clears previous display history', () => {
  const display = new ComboWindow();
  display.add(5, 30);
  display.clear();
  expect(display.value(0)).toBe(0);
});
