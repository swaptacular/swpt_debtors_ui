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

export type CoinInfo = {
  type: 'CoinInfo',
  uri: string,
  revision: number,
  validUntil?: Date,
  latestCoinInfo: ResourceReference,
  debtorIdentity: DebtorIdentity,
  debtorName: string,
  debtorHomepage?: ResourceReference,
  amountDevisor: number,
  decimalPlaces: number,
  unit: string,
  peg?: CoinPeg,
}

export class InvalidCoinInfo extends Error {
  name = 'InvalidCoinInfo'
}

export const MIME_TYPE_COIN_INFO = 'application/vnd.swaptacular.coin-info+json'

export function generateCoinInfoBlob(coinInfo: CoinInfo): Blob {
  if (coinInfo.validUntil && Number.isNaN(coinInfo.validUntil.getTime())) {
    throw new InvalidCoinInfo('invalid validUntil')
  }
  const validUntil = coinInfo.validUntil?.toISOString()
  const data = { ...coinInfo, validUntil }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidCoinInfo(`${e.instancePath} ${e.message}`)
  }
  const content = UTF8_ENCODER.encode(JSON.stringify(coinInfo))
  return new Blob([content], { type: MIME_TYPE_COIN_INFO })
}

export async function parseCoinInfoBlob(blob: Blob): Promise<CoinInfo> {
  if (blob.type && blob.type !== MIME_TYPE_COIN_INFO) {
    throw new InvalidCoinInfo('wrong content type')
  }
  let coinInfo
  try {
    coinInfo = JSON.parse(await blob.text()) as CoinInfo
  } catch (e: unknown) {
    throw new InvalidCoinInfo('parse error')
  }
  if (!validate(coinInfo)) {
    const e = validate.errors[0]
    throw new InvalidCoinInfo(`${e.instancePath} ${e.message}`)
  }
  const isoValidUntil = coinInfo.validUntil
  const validUntil = isoValidUntil ? new Date(isoValidUntil) : undefined
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    throw new InvalidCoinInfo('invalid validUntil')
  }
  return coinInfo
}
