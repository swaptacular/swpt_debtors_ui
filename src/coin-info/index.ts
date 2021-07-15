import validate from './validate-schema.js'

const UTF8_ENCODER = new TextEncoder()

export type ResourceReference = {
  /** The URI of the object. Can be a relative URI. */
  uri: string,
}

export type DebtorIdentity = {
  type: 'DebtorIdentity',

  /** The information contained in this field must be enough to
   * uniquely and reliably identify the debtor. Note that a network
   * request *should not be needed* to identify the debtor. */
  uri: string,
}

export type CoinPeg = {
  type: 'CoinPeg',
  exchangeRate: number,
  debtorIdentity: DebtorIdentity,
  latestCoinInfo: ResourceReference,
}

export type BaseCoinInfo = {
  summary?: string,
  debtorName: string,
  debtorHomepage?: ResourceReference,
  amountDevisor: number,
  decimalPlaces: number,
  unit: string,
  peg?: CoinPeg,
}

export type CoinInfo = BaseCoinInfo & {
  type: 'CoinInfo',
  uri: string,
  revision: number,
  willNotChangeUntil?: Date,
  latestCoinInfo: ResourceReference,
  debtorIdentity: DebtorIdentity,
}

export class InvalidCoinInfo extends Error {
  name = 'InvalidCoinInfo'
}

export const MIME_TYPE_COIN_INFO = 'application/vnd.swaptacular.coin-info+json'

function validateOptionalDate(date?: Date): void {
  if (
    date !== undefined && (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() > 9999 ||
      date.getFullYear() < 1970
    )
  ) throw new InvalidCoinInfo('invalid date')
}

export function generateCoinInfoBlob(coinInfo: CoinInfo): Blob {
  validateOptionalDate(coinInfo.willNotChangeUntil)
  const data = { ...coinInfo, willNotChangeUntil: coinInfo.willNotChangeUntil?.toISOString() }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidCoinInfo(`${e.instancePath} ${e.message}`)
  }
  const content = UTF8_ENCODER.encode(JSON.stringify(data))
  return new Blob([content], { type: MIME_TYPE_COIN_INFO })
}

export async function parseCoinInfoBlob(blob: Blob): Promise<CoinInfo> {
  if (blob.type && blob.type !== MIME_TYPE_COIN_INFO) {
    throw new InvalidCoinInfo('wrong content type')
  }
  let data
  try {
    data = JSON.parse(await blob.text())
  } catch {
    throw new InvalidCoinInfo('parse error')
  }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidCoinInfo(`${e.instancePath} ${e.message}`)
  }
  const willNotChangeUntil = data.willNotChangeUntil ? new Date(data.willNotChangeUntil) : undefined
  validateOptionalDate(willNotChangeUntil)
  return { ...data, willNotChangeUntil }
}
