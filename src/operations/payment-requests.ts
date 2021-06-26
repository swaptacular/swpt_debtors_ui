import CRC32 from 'crc-32'

const PAYMENT_REQUEST_REGEXP = /^PR0\r?\n(?<crc32>(?:[0-9a-f]{8})?)\r?\n(?<accountUri>.{0,200})\r?\n(?<payeeName>.{0,500})\r?\n(?<amount>\d{1,20})(?:\r?\n(?<deadline>(?:\d{4}-\d{2}-\d{2}.{0,32})?)(?:\r?\n(?<payeeReference>.{0,500})(?:\r?\n(?<descriptionFormat>.{0,500})(?:\r?\n(?<description>[\s\S]{0,500}))?)?)?)?$/u
const PAYEEREF_TRANSFER_NOTE_REGEXP = /^(?<payeeReference>.{0,500})(?:\r?\n(?<payeeName>.{0,500})(?:\r?\n(?<descriptionFormat>.{0,500})(?:\r?\n(?<description>[\s\S]{0,500}))?)?)?/u
const MAX_INT64 = 2n ** 63n - 1n
const uft8encoder = new TextEncoder()

function removePr0Header(bytes: Uint8Array): Uint8Array {
  const endOfFirstLine = bytes.indexOf(10)
  const endOfSecondLine = bytes.indexOf(10, endOfFirstLine + 1)
  return bytes.slice(endOfSecondLine + 1)
}

function createTextBlob(text: string): Blob {
  return new Blob([uft8encoder.encode(text)], { type: 'text/plain; charset=utf-8' })
}

function parsePayeerefTransferNote(note: string): PaymentInfo {
  const regexpMatch = note.match(PAYEEREF_TRANSFER_NOTE_REGEXP) as RegExpMatchArray  // always matches
  const groups = regexpMatch.groups
  const paymentInfo: PaymentInfo = { payeeReference: groups!.payeeReference }

  const payeeName = groups?.payeeName
  if (payeeName) {
    paymentInfo.payeeName = payeeName
  }

  const description = groups?.description ?? ''
  switch (groups?.descriptionFormat) {
    case '':
      // plain text
      if (description !== '') {
        paymentInfo.paymentReason = createTextBlob(description)
      }
      break
    case '.':
      // an URL
      paymentInfo.paymentReason = description
      break
  }
  return paymentInfo
}

export const MIME_TYPE_PR0 = 'application/vnd.swaptacular.pr0'

export type DocumentUri = string

export type PaymentInfo = {
  payeeReference?: string,
  payeeName?: string,
  paymentReason?: DocumentUri | Blob,
  documents?: Map<DocumentUri, Blob>,
}

export type PaymentRequest = {
  accountUri: string,
  payeeName: string,
  amount: bigint,
  deadline?: Date,
  payeeReference: string,
  descriptionFormat: string,
  description: string,
}

export class IvalidPaymentRequest extends Error {
  name = 'IvalidPaymentRequest'
}

/*
 This function genarates a payment request file (a `Blob`) in
 "text/vnd.swaptacular.pr0" format (Swaptacular Payment Request
 v0). This is a minimalist text format, whose goal is to be human
 readable, and yet be as concise as possible, so that it can be
 transferred via QR codes.

 An example payment request:
 ```````````````````````````````````````````````
 PR0

 swpt:112233445566778899/998877665544332211
 Payee Name
 1000
 2021-07-30T16:00:00Z
 12d3a45642665544

 This is a description of the reason
 for the payment. It may contain multiple
 lines. Everything until the end of the file
 is considered as part of the description.
 ```````````````````````````````````````````````

 In the example above:

 * "PR0" identifies the type of the file.

 * An optional CRC32 value can be included with the request (the empty
   second line). If included, it should contain exactly 8 hexadecimal
   lowercase symbols.

 * "swpt:112233445566778899/998877665544332211" refers to the payee's
   account.

 * "Payee Name" indicates the name of the payee.

 * "1000" is the requested amount.

 * "2021-07-30T16:00:00Z" indicates the deadline for the payment. This
   field is optional and can be an empty string.

 * "12d3a45642665544" is the payee reference (a unique string), which
   should to be included by the payer in the payment note, so that the
   payee can match the incoming payment with the payment request.

 * Also, an optional description format can be passed (the empty line
   right before the description). When an empty string is passed, this
   means that the description is in plain text. The symbol "."
   indicates that the description contains the URI of the document
   that describes the payment request.

 A `IvalidPaymentRequest` error will be thrown if the length of the
 automatically generated "payeeref" transfer note for the payment
 exceeds `noteMaxBytes`.
*/
export function generatePr0Blob(
  request: PaymentRequest,
  options: { noteMaxBytes?: number, includeCrc?: boolean } = {}
): Blob {
  const { noteMaxBytes = 500, includeCrc = true } = options
  generatePayeerefTransferNote(request, noteMaxBytes)  // May throw `IvalidPaymentRequest`.

  const deadline = request.deadline ? request.deadline.toISOString() : ''
  const body = uft8encoder.encode(
    `${request.accountUri}\n` +
    `${request.payeeName}\n` +
    `${request.amount}\n` +
    `${deadline}\n` +
    `${request.payeeReference}\n` +
    `${request.descriptionFormat}\n` +
    `${request.description}`
  )
  const crc32 = includeCrc ? (CRC32.buf(body) >>> 0).toString(16).padStart(8, '0') : ''
  const header = uft8encoder.encode(`PR0\n${crc32}\n`)
  return new Blob([header, body], { type: MIME_TYPE_PR0 })
}

/*
 Currently, this function can parse only files with content type
 "text/vnd.swaptacular.pr0" (Swaptacular Payment Request v0). This is
 a minimalist text format, whose goal is to be human readable, and yet
 be as concise as possible, so that it can be transferred via QR
 codes.
*/
export async function parsePaymentRequest(blob: Blob): Promise<PaymentRequest & { contentType: string }> {
  if (blob.type && blob.type !== MIME_TYPE_PR0) {
    throw new IvalidPaymentRequest('wrong content type')
  }
  const regexpMatch = (await blob.text()).match(PAYMENT_REQUEST_REGEXP)
  if (!regexpMatch) {
    throw new IvalidPaymentRequest('parse error')
  }
  const groups: any = regexpMatch.groups

  if (groups.crc32 !== '') {
    const buffer = await blob.arrayBuffer()
    const uint32 = CRC32.buf(removePr0Header(new Uint8Array(buffer))) >>> 0
    const crc32 = uint32.toString(16).padStart(8, '0')
    if (crc32 !== groups.crc32) {
      throw new IvalidPaymentRequest('CRC error')
    }
  }

  const amount = BigInt(groups.amount)
  if (amount > MAX_INT64) {
    throw new IvalidPaymentRequest('invalid amount')
  }

  let deadline
  if (groups.deadline) {
    deadline = new Date(groups.deadline)
    if (Number.isNaN(deadline.getTime())) {
      throw new IvalidPaymentRequest('invalid deadline')
    }
  }

  const request = {
    contentType: MIME_TYPE_PR0,
    accountUri: groups.accountUri,
    payeeName: groups.payeeName,
    amount,
    deadline,
    payeeReference: groups.payeeReference ?? '',
    descriptionFormat: groups.descriptionFormat ?? '',
    description: groups.description ?? '',
  }
  return request
}

/*
 This function generates a tranfer note for a payment in "payeeref"
 format. This is a very simple format that contains the payee
 reference as a first line, and optionally may include the payee name,
 and a payment description.

 An example transfer note in "payeeref" fromat:
 ```````````````````````````````````````````````
 12d3a45642665544
 Payee Name

 This is a description of the reason
 for the payment. It may contain multiple
 lines. Everything until the end of the file
 is considered as part of the description.
 ```````````````````````````````````````````````

 In the example above:

 * "12d3a45642665544" is the payee reference (a unique string), which
   is included by the payer in the payment note, so that the payee can
   match the incoming payment with the payment request.

 * "Payee Name" indicates the name of the payee (optional).

 * Also, an optional description format can be passed (the empty line
   right before the description). When an empty string is passed, this
   means that the description is in plain text. The symbol "."
   indicates that the description contains the URI of the document
   that describes the payment.

 A `IvalidPaymentRequest` error will be thrown if the length of the
 generated note exceeds `noteMaxBytes`.
*/
export function generatePayeerefTransferNote(request: PaymentRequest, noteMaxBytes: number = 500): string {
  const note =
    `${request.payeeReference}\n` +
    `${request.payeeName}\n` +
    `${request.descriptionFormat}\n` +
    `${request.description}`

  if (uft8encoder.encode(note).length > noteMaxBytes) {
    throw new IvalidPaymentRequest('too big')
  }
  return note
}

/*
 Currently, this function can usefully parse only transfer notes with
 format "" (plain text), and "payeeref".
*/
export function parseTransferNote({ note, noteFormat }: { note: string, noteFormat: string }): PaymentInfo {
  switch (noteFormat) {
    case '':
      return note === '' ? {} : { paymentReason: createTextBlob(note) }
    case 'payeeref':
      return parsePayeerefTransferNote(note)
    default:
      return {}
  }
}
