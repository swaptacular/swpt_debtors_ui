import CRC32 from 'crc-32'

const PAYMENT_REQUEST_REGEXP = /^PR0\r?\n(?<crc32>(?:[0-9a-f]{8})?)\r?\n(?<accountUri>.{0,200})\r?\n(?<payeeName>.{0,200})\r?\n(?<amount>\d{1,20})(?:\r?\n(?<deadline>(?:\d{4}-\d{2}-\d{2}.{0,32})?)(?:\r?\n(?<payeeReference>.{0,200})(?:\r?\n(?<descriptionFormat>[0-9A-Za-z.-]{0,8})(?:\r?\n(?<description>[\s\S]{0,3000}))?)?)?)?$/u
const PAYEEREF_TRANSFER_NOTE_REGEXP = /^(?<payeeReference>.{0,200})(?:\r?\n(?<payeeName>.{0,200})(?:\r?\n(?<descriptionFormat>[0-9A-Za-z.-]{0,8})(?:\r?\n(?<description>[\s\S]{0,3000}))?)?)?$/u
const MAX_INT64 = 2n ** 63n - 1n
const UTF8_ENCODER = new TextEncoder()
const DEFAULT_NOTE_MAX_BYTES = 500  // Defined in the spec as an upper limit.
const FORBIDDEN_REQUEST_FORMATS = new Set<string>(['-', 'payeeref', 'payeere0'])

/*
 We want to ensure that the payer will be able use an UUID as a short
 payer reference instead of, or in addition to, the original payment
 request description.
*/
const DEFAULT_SURPLUS_BYTES = (
  8  // the maximun allowed `noteFormat` bytes
  + 36  // the number of bytes in the canonical UUID textual representation
)

class InvalidTransferNote extends Error {
  name = 'InvalidTransferNote'
}

function removePr0Header(bytes: Uint8Array): Uint8Array {
  const endOfFirstLine = bytes.indexOf(10)
  const endOfSecondLine = bytes.indexOf(10, endOfFirstLine + 1)
  return bytes.slice(endOfSecondLine + 1)
}

function isValidPr0Data(request: PaymentRequest): boolean {
  return Boolean(
    request.accountUri.match(/^.{0,200}$/u) &&
    request.payeeName.match(/^.{0,200}$/u) &&
    request.amount >= 0n &&
    request.amount <= MAX_INT64 &&
    request.payeeReference.match(/^.{0,200}$/u) &&
    request.description.content.length <= 3000 &&
    !FORBIDDEN_REQUEST_FORMATS.has(request.description.contentFormat) &&
    request.description.contentFormat.match(/[0-9A-Za-z.-]{0,8}/)
  )
}

function isValidPayeerefData(request: PaymentInfo): boolean {
  return Boolean(
    request.payeeName.match(/^.{0,200}$/u) &&
    request.payeeReference.match(/^.{0,200}$/u) &&
    request.description.content.length <= 3000 &&
    request.description.contentFormat.match(/[0-9A-Za-z.-]{0,8}/)
  )
}

function calcPayeerefNoteByteLength(info: PaymentInfo): number {
  // The "+ 3" thing allows for the use of "\r\n", instead of "\n".
  return UTF8_ENCODER.encode(generatePayeerefTransferNote(info, Infinity)).length + 3
}

function parsePayeerefTransferNote(note: string): PaymentInfo {
  const regexpMatch = note.match(PAYEEREF_TRANSFER_NOTE_REGEXP)
  if (!regexpMatch) {
    throw new InvalidTransferNote('parse error')
  }
  const groups = regexpMatch.groups
  return {
    payeeReference: groups?.payeeReference ?? '',
    payeeName: groups?.payeeName ?? '',
    description: {
      contentFormat: groups?.descriptionFormat ?? '',
      content: groups?.description ?? '',
    },
  }
}

export const MIME_TYPE_PR0 = 'application/vnd.swaptacular.pr0'

export type DocumentUri = string

export type PaymentDescription = {
  /*
   The currently defined content formats are:
     "" plain text
     "." an URI
     "-" a payer reference (the content is client-specific)
     "payeeref" payee reference container format
     "payeere0" payee reference container format (an alternative name)
  */
  contentFormat: string,
  content: string,
}

export type PaymentInfo = {
  payeeName: string,
  payeeReference: string,
  description: PaymentDescription,
}

export type PaymentRequest =
  & PaymentInfo
  & {
    accountUri: string,
    amount: bigint,
    deadline?: Date,
  }

export class IvalidPaymentRequest extends Error {
  name = 'IvalidPaymentRequest'
}

export class IvalidPaymentData extends Error {
  name = 'IvalidPaymentData'
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
   should to be included by the payer in the transfer note, so that
   the payee can match the incoming transfer with the payment request.

 * Also, an optional description format can be passed (the empty line
   right before the description). When an empty string is passed, this
   means that the description is in plain text. The symbol "."
   indicates that the description contains the URI of the document
   that describes the payment request.

 An `IvalidPaymentData` error will be thrown if invalid payment data
 is passed. Also, this function will try to simulate generating a
 "payeeref" transfer note for the payment. An `IvalidPaymentData`
 error will be thrown if the length of the generated transfer note
 (plus `surplusBytes`) would exceed `noteMaxBytes`.
*/
export function generatePr0Blob(
  request: PaymentRequest,
  options: { includeCrc?: boolean, noteMaxBytes?: number, surplusBytes?: number } = {}
): Blob {
  const { includeCrc = true, noteMaxBytes = DEFAULT_NOTE_MAX_BYTES, surplusBytes = DEFAULT_SURPLUS_BYTES } = options
  if (!isValidPr0Data(request)) {
    throw new IvalidPaymentData('invalid field')
  }
  if (calcPayeerefNoteByteLength(request) + surplusBytes > noteMaxBytes) {
    throw new IvalidPaymentData('too big')
  }
  const isoDeadline = request.deadline ? request.deadline.toISOString() : ''
  const body = UTF8_ENCODER.encode(
    `${request.accountUri}\n` +
    `${request.payeeName}\n` +
    `${request.amount}\n` +
    `${isoDeadline}\n` +
    `${request.payeeReference}\n` +
    `${request.description.contentFormat}\n` +
    `${request.description.content}`
  )
  const crc32 = includeCrc ? (CRC32.buf(body) >>> 0).toString(16).padStart(8, '0') : ''
  const header = UTF8_ENCODER.encode(`PR0\n${crc32}\n`)
  return new Blob([header, body], { type: MIME_TYPE_PR0 })
}

/*
 Currently, this function can parse only files with content type
 "text/vnd.swaptacular.pr0" (Swaptacular Payment Request v0). An
 `IvalidPaymentRequest` error will be thrown if the blob can not be parsed.
*/
export async function parsePaymentRequest(blob: Blob): Promise<PaymentRequest> {
  if (blob.type && blob.type !== MIME_TYPE_PR0) {
    throw new IvalidPaymentRequest('wrong content type')
  }
  const regexpMatch = (await blob.text()).match(PAYMENT_REQUEST_REGEXP)
  if (!regexpMatch) {
    throw new IvalidPaymentRequest('parse error')
  }
  const groups = regexpMatch.groups
  const crc32 = groups!.crc32
  if (crc32) {
    const buffer = await blob.arrayBuffer()
    const uint32 = CRC32.buf(removePr0Header(new Uint8Array(buffer))) >>> 0
    const crc32 = uint32.toString(16).padStart(8, '0')
    if (crc32 !== crc32) {
      throw new IvalidPaymentRequest('CRC error')
    }
  }
  const amount = BigInt(groups!.amount)
  if (amount > MAX_INT64) {
    throw new IvalidPaymentRequest('invalid amount')
  }
  const isoDeadline = groups?.deadline
  const deadline = isoDeadline ? new Date(isoDeadline) : undefined
  if (deadline && Number.isNaN(deadline.getTime())) {
    throw new IvalidPaymentRequest('invalid deadline')
  }
  const contentFormat = groups?.descriptionFormat ?? ''
  if (FORBIDDEN_REQUEST_FORMATS.has(contentFormat)) {
    throw new IvalidPaymentRequest('forbidden description format')
  }
  return {
    amount,
    deadline,
    accountUri: groups!.accountUri,
    payeeName: groups!.payeeName,
    payeeReference: groups?.payeeReference ?? '',
    description: {
      contentFormat,
      content: groups?.description ?? '',
    },
  }
}

/*
 This function generates a tranfer note for a payment in "payeeref"
 format. This is a very simple format that contains the payee
 reference as a first line, and optionally may include the payee
 name, and a payment description.

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

 * "12d3a45642665544" is the payee reference (it can be an empty
   string), which is included by the payer in the transfer note, so
   that the payee can match the incoming transfer with the payment
   request.

 * "Payee Name" indicates the name of the payee (it can be an empty
   string).

 * Also, an optional description format can be passed (the empty line
   right before the description). When an empty string is passed, this
   means that the description is in plain text. The symbol "."
   indicates that the description contains the URI of the document
   that describes the payment.

 An alternative name for the "payeeref" format is
 "payeere0". Implementations may use both names interchangeably, as
 they see fit.

 An `IvalidPaymentData` error will be thrown if the length of the
 generated note exceeds `noteMaxBytes`, or invalid payment data is
 passed.
*/
export function generatePayeerefTransferNote(info: PaymentInfo, noteMaxBytes: number = DEFAULT_NOTE_MAX_BYTES): string {
  if (!isValidPayeerefData(info)) {
    throw new IvalidPaymentData('invalid field')
  }
  const note =
    `${info.payeeReference}\n` +
    `${info.payeeName}\n` +
    `${info.description.contentFormat}\n` +
    `${info.description.content}`

  if (UTF8_ENCODER.encode(note).length > noteMaxBytes) {
    throw new IvalidPaymentData('too big')
  }
  return note
}

/*
 Currently, this function can usefully parse only transfer notes with
 format "" (plain text), and "payeeref".
*/
export function parseTransferNote(noteData: { noteFormat: string, note: string }): PaymentInfo {
  const { noteFormat, note } = noteData
  const description = { contentFormat: noteFormat, content: note }
  try {
    switch (noteFormat) {
      case '':
        // A simple convenience: In plain text messages, if the payee's
        // name is enclosed in backticks, it will be recognized and
        // extracted. For example: "Paying my debt to `Santa Claus`".
        const payeeName = note.match(/`([^`]+)`/u)?.[1] ?? ''
        return {
          payeeName: payeeName.split(/\s+/u).join(' ').match(/.{0,200}/u)?.[0] ?? '',
          payeeReference: '',
          description,
        }

      case '.':
      case '-':
        return {
          payeeName: '',
          payeeReference: '',
          description,
        }

      case 'payeere0':
      case 'payeeref':
        return parsePayeerefTransferNote(note)
    }
  } catch (e: unknown) {
    if (!(e instanceof InvalidTransferNote)) throw e
  }

  return {
    payeeName: '',
    payeeReference: note.match(/.{0,200}/u)?.[0] ?? '',
    description,
  }
}
