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
      date.getFullYear() > 9998 ||
      date.getFullYear() < 1970
    )
  ) throw new InvalidDebtorData('/willNotChangeUntil must be in ISO 8601 format')
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
  latestDebtorInfo: ResourceReference,
}

export type BaseDebtorData = {
  summary?: string,
  debtorName: string,
  debtorHomepage?: ResourceReference,
  amountDivisor: number,
  decimalPlaces: number,
  unit: string,
  peg?: CoinPeg,
}

export type DebtorData = BaseDebtorData & {
  uri: string,
  debtorIdentity: DebtorIdentity,
  revision: number,
  latestDebtorInfo: ResourceReference,
  willNotChangeUntil?: Date,
}

export class InvalidDebtorData extends Error {
  name = 'InvalidDebtorData'
}

export const MIME_TYPE_COIN_INFO = 'application/vnd.swaptacular.coin-info+json'

/*
 This function genarates a "CoinInfo" file (a `Blob`) in
 "application/vnd.swaptacular.coin-info+json" format. This format is
 defined by a JSON Schema file (see "./schema.json",
 "./schema.md"). An `InvalidDebtorData` error will be thrown when
 invalid data is passed.
*/
export function generateCoinInfoBlob(debtorData: DebtorData): Blob {
  validateOptionalDate(debtorData.willNotChangeUntil)
  const data = {
    ...debtorData,
    type: 'CoinInfo',
    willNotChangeUntil: debtorData.willNotChangeUntil?.toISOString(),
  }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidDebtorData(`${e.instancePath} ${e.message}`)
  }
  const content = UTF8_ENCODER.encode(JSON.stringify(data))
  return new Blob([content], { type: MIME_TYPE_COIN_INFO })
}

/*
 Currently, this function can parse only files with content type
 "application/vnd.swaptacular.coin-info+json". An `InvalidDebtorData`
 error will be thrown if the blob can not be parsed.
*/
export async function parseDebtorInfoBlob(blob: Blob): Promise<DebtorData> {
  if (blob.type && blob.type !== MIME_TYPE_COIN_INFO) {
    throw new InvalidDebtorData('wrong content type')
  }
  if (blob.size > MAX_BLOB_SIZE) {
    throw new InvalidDebtorData('too big')
  }
  let data
  try {
    data = JSON.parse(await blob.text())
  } catch {
    throw new InvalidDebtorData('parse error')
  }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidDebtorData(`${e.instancePath} ${e.message}`)
  }
  let willNotChangeUntil
  if (data.willNotChangeUntil) {
    willNotChangeUntil = new Date(data.willNotChangeUntil)
    if (Number.isNaN(willNotChangeUntil.getTime())) {
      willNotChangeUntil = undefined
    }
  }
  delete data.type
  return { ...data, willNotChangeUntil }
}
