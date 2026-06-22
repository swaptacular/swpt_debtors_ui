import * as msg from "./messages";
import type { TransferRecord } from './operations'

export function stringToAmount(s: string | number, amountDivisor: number): bigint {
  return BigInt(Math.round(Number(s) * amountDivisor))
}

export function amountToString(value: number | bigint, amountDivisor: number, decimalPlaces: number | bigint): string {
  if (typeof decimalPlaces === 'bigint') {
    decimalPlaces = Number(decimalPlaces)
  }
  const v = Number(value) / amountDivisor
  const n = Math.min(Math.ceil(decimalPlaces), 20)
  let s
  if (n >= 0) {
    s = v.toFixed(n)
  } else {
    const numDigits = Math.ceil(Math.log10(Math.abs(v)))
    const precision = Math.min(numDigits + n, 100)
    s = precision >= 1 ? v.toPrecision(precision) : '0'
  }
  return scientificToRegular(s)
}

function scientificToRegular(scientific: string): string {
  let [mantissa, exponent = '0'] = scientific.toLowerCase().split('e')
  let e = Number(exponent)
  let sign = ''
  if (mantissa.startsWith('-') || mantissa.startsWith('+')) {
    if (mantissa[0] === '-') {
      sign = '-'
    }
    mantissa = mantissa.slice(1)
  }
  if (!Number.isFinite(e)) {
    throw new SyntaxError(scientific)
  }
  const decimalPointIndex = mantissa.indexOf('.')
  if (decimalPointIndex > -1) {
    e -= (mantissa.length - decimalPointIndex - 1)
    mantissa = removeLeadingZeroes(mantissa.slice(0, decimalPointIndex) + mantissa.slice(decimalPointIndex + 1))
  }
  switch (true) {
    case e >= 0:
      return sign + mantissa + '0'.repeat(e)
    case e > -mantissa.length:
      return sign + mantissa.slice(0, e) + '.' + mantissa.slice(e)
    default:
      return sign + '0.' + '0'.repeat(-mantissa.length - e) + mantissa
  }
}

function removeLeadingZeroes(s: string): string {
  return s.match(/^0*([\s\S]*)$/)?.[1] as string
}

function getFailureReason(errorCode: string): string {
  switch (errorCode) {
    case 'CANCELED_BY_THE_SENDER':
      return msg.CANCELED_BY_THE_SENDER
    case 'SENDER_IS_UNREACHABLE':
      return msg.SENDER_IS_UNREACHABLE
    case 'RECIPIENT_IS_UNREACHABLE':
      return msg.RECIPIENT_IS_UNREACHABLE
    case 'RECIPIENT_SAME_AS_SENDER':
      return msg.RECIPIENT_SAME_AS_SENDER
    case 'NO_RECIPIENT_CONFIRMATION':
      return msg.NO_RECIPIENT_CONFIRMATION
    case 'TRANSFER_NOTE_IS_TOO_LONG':
      return msg.TRANSFER_NOTE_IS_TOO_LONG
    case 'INSUFFICIENT_AVAILABLE_AMOUNT':
      return msg.INSUFFICIENT_AVAILABLE_AMOUNT
    case 'TIMEOUT':
      return msg.TIMEOUT
    case 'NEWER_INTEREST_RATE':
      return msg.NEWER_INTEREST_RATE
    default:
      return errorCode
  }
}

export function getTooltip(t: TransferRecord): string {
  let tooltip = `The payment has been initiated at ${new Date(t.initiatedAt).toLocaleString()}`
  if (t.result) {
    const finalizedAt = new Date(t.result.finalizedAt).toLocaleString()
    if (t.result.error) {
      const reason = getFailureReason(t.result.error.errorCode)
      tooltip += `, and failed at ${finalizedAt}.`
      tooltip += `The reason for the failure is: "${reason}"`
    } else {
      tooltip += `, and succeeded at ${finalizedAt}.`
      const paymentRefernece = t.paymentInfo.payeeReference
      if (paymentRefernece) {
        const maxLength = 64
        const shortRef = paymentRefernece.length <= maxLength
          ? paymentRefernece
          : `${paymentRefernece.slice(0, maxLength)}...`
        tooltip += ` The payment reference is: "${shortRef}".`
      }
    }
  } else {
    tooltip += '.'
  }
  return tooltip
}

export function getDebtorIdentityFromAccountIdentity(uri: string): string | undefined {
  const parts = uri.split('/')
  if (uri.startsWith('swpt:') && parts.length === 2) {
    return parts[0]
  }
  return undefined
}
