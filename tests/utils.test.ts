import { amountToString, stringToAmount } from '../src/utils'

test("Amount to string", () => {
  expect(amountToString(-10000000n, 1, -2)).toBe('-10000000')
  expect(amountToString(10000000n, 1, -2)).toBe('10000000')
  expect(amountToString(12345648n, 1, -2)).toBe('12345600')
  expect(amountToString(12345678n, 1, -2)).toBe('12345700')
  expect(amountToString(12345678n, 10, 1)).toBe('1234567.8')
  expect(amountToString(12345678n, 0, 1).toLowerCase()).toBe('infinity')
  expect(amountToString(12345678n, 1, 2)).toBe('12345678.00')
  expect(amountToString(12345678n, 10000000000, 5)).toBe('0.00123')
  expect(amountToString(-12345678n, 1, 2)).toBe('-12345678.00')
})

test("String to amount", () => {
  expect(stringToAmount('1.23', 100)).toBe(123n)
})
