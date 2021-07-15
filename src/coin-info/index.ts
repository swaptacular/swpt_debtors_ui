/* NOTE: The file `./validate-schema.js` is automatically generated
 * from the `./schema.json` file, by running the following command:
 *
 * $ npx ajv compile -s schema.json -o validate-schema.js --strict=true --remove-additional=all --validate-formats=false
 */
import validate from './validate-schema.js'

const UTF8_ENCODER = new TextEncoder()
const MAX_BLOB_SIZE = 5 * 1024 * 1024

function validateOptionalDate(date?: Date): void {
  if (
    date !== undefined && (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() > 9999 ||
      date.getFullYear() < 1970
    )
  ) throw new InvalidCoinInfo('invalid date')
}

export type ResourceReference = {
  uri: string,
}

export type DebtorIdentity = {
  type: 'DebtorIdentity',
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
  amountDivisor: number,
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

/*
 This function genarates a "CoinInfo" file (a `Blob`) in
 "application/vnd.swaptacular.coin-info+json" format. This format is
 defined by a JSON Schema file (see "./schema.json",
 "./schema.md"). An `InvalidCoinInfo` error will be thrown when
 invalid data is parsed.
*/
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

/*
 This function parses files with content type
 "application/vnd.swaptacular.coin-info+json". An `InvalidCoinInfo`
 error will be thrown if the blob can not be parsed.
*/
export async function parseCoinInfoBlob(blob: Blob): Promise<CoinInfo> {
  if (blob.type && blob.type !== MIME_TYPE_COIN_INFO) {
    throw new InvalidCoinInfo('wrong content type')
  }
  if (blob.size > MAX_BLOB_SIZE) {
    throw new InvalidCoinInfo('too big')
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
