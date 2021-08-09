export function roundAmount(value: number, decimalPlaces: number): number {
  const numDigits = Math.ceil(Math.log10(value))
  const precision = Math.ceil(decimalPlaces) + numDigits
  if (precision < 0) {
    return 0
  } else {
    const scale = Math.pow(10, -numDigits)
    return Number((value * scale).toFixed(precision)) / scale
  }
}
