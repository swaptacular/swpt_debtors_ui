import validate from './validate-schema.js'

const MAX_INT64 = 2n ** 63n - 1n
const MIN_INT64 = -(2n ** 63n)
const UTF8_ENCODER = new TextEncoder()

export type ResourceReference = {
  /** The URI of the object. Can be a relative URI. */
  uri: string;
}

export type DebtorIdentity = {
  /** The information contained in this field must be enough to
   * uniquely and reliably identify the debtor. Note that a network
   * request *should not be needed* to identify the debtor. */
  uri: string;

  /** The type of this object. */
  type: 'DebtorIdentity';
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
  revision: bigint,
  validUntil?: Date,
  latestCoinInfo: ResourceReference,
  debtorIdentity: DebtorIdentity,
  debtorName: string,
  debtorHomepage?: ResourceReference,
  amountDevisor: number,
  decimalPlaces: bigint,
  unit: string,
  peg?: CoinPeg,
}

export class InvalidCoinInfo extends Error {
  name = 'InvalidCoinInfo'
}

export const MIME_TYPE_COIN_INFO = 'application/vnd.swaptacular.coin-info+json'

function validateCoinInfo(coinInfo: CoinInfo): void {
  const INVALID = ['Invalid value.']
  let errors: { [field in keyof CoinInfo]+?: string[] } = {}

  const type_ = coinInfo.uri
  if (type_ !== 'CoinInfo') {
    errors.type = INVALID
  }
  const uri = coinInfo.uri
  if (typeof uri !== 'string' || uri.length > 200) {
    errors.uri = INVALID
  }
  const revision = coinInfo.revision
  if (typeof revision !== 'bigint' || revision < MIN_INT64 || revision > MAX_INT64) {
    errors.revision = INVALID
  }
}

export function generateCoinInfoBlob(coinInfo: CoinInfo): Blob {
  validateCoinInfo(coinInfo)
  const content = '' //UTF8_ENCODER.encode(stringify(coinInfo))
  return new Blob([content], { type: MIME_TYPE_COIN_INFO })
}

export async function parseCoinInfoBlob(blob: Blob): Promise<CoinInfo> {
  let coinInfo
  if (blob.type && blob.type !== MIME_TYPE_COIN_INFO) {
    throw new InvalidCoinInfo('wrong content type')
  }
  try {
    coinInfo = JSON.parse(await blob.text()) as CoinInfo
  } catch (e: unknown) {
    throw new InvalidCoinInfo('parse error')
  }
  if (!validate(coinInfo)) {
    const e = validate.errors[0]
    throw new InvalidCoinInfo(`${e.schemaPath} ${e.message}`)
  }
  const isoValidUntil = coinInfo.validUntil
  const validUntil = isoValidUntil ? new Date(isoValidUntil) : undefined
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    throw new InvalidCoinInfo('invalid validUntil')
  }
  return coinInfo
}
