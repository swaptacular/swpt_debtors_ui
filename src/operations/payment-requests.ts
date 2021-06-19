import CRC32 from 'crc-32'

const PAYMENT_REQUEST_REGEXP = /^PR0\r?\n(?<crc32>(?:[0-9a-f]{8})?)\r?\n(?<accountUri>.{0,200})\r?\n(?<payeeName>.{0,200})\r?\n(?<amount>\d{0,20})\r?\n(?<deadline>(?:\d{4}-\d{2}-\d{2}.{0,200})?)\r?\n(?<payeeReference>.{0,200})\r?\n(?<descriptionFormat>.{0,200})\r?\n(?<description>[\s\S]{0,20000})$/u

const MAX_INT64 = 2n ** 63n - 1n

function removePr0Header(bytes: Uint8Array): Uint8Array {
  const endOfFirstLine = bytes.indexOf(10)
  const endOfSecondLine = bytes.indexOf(10, endOfFirstLine + 1)
  return bytes.slice(endOfSecondLine + 1)
}

export const MIME_TYPE_PR0 = 'text/vnd.swaptacular.pr0'

export type PaymentRequest = {
  contentType: string,
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
 Reads files with content type "application/vnd.swaptacular.pr0"
 (Payment Request version 0). This is a minimalist text format, whose
 goal is to be human readable, and yet be as concise as possible, so
 that it can be transfered via QR codes.

 An example payment request:
 ```````````````````````````````````````````````
 PR0

 swpt:112233445566778899/998877665544332211
 The name of the payee
 1000
 2021-07-30T16:00:00Z
 12d3a45642665544

 This is a description of the reason
 for the payment. It may contain multiple
 lines. Everything until the end of the file
 is considered as part of the description.
 ```````````````````````````````````````````````

 In the example above, "swpt:112233445566778899/998877665544332211"
 refers to the payee's account, "1000" is the requested amount,
 "2021-07-30T16:00:00Z" indicates the deadline for the payment,
 "12d3a45642665544" is the payee reference which need to be included
 in the payment note. An optional CRC32 value can be included in the
 request (the empty second row). Also, an optional description format
 can be passed (the empty row before the description). When not passed
 (an empty string), this means that the description is in plain text.

*/
export async function parsePaymentRequest(blob: Blob): Promise<PaymentRequest> {
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
  if (groups.deadline !== '') {
    deadline = new Date(groups.deadline)
    if (Number.isNaN(deadline.getTime())) {
      throw new IvalidPaymentRequest('invalid deadline')
    }
  }

  return {
    contentType: MIME_TYPE_PR0,
    accountUri: groups.accountUri,
    payeeName: groups.payeeName,
    amount,
    deadline,
    payeeReference: groups.payeeReference,
    descriptionFormat: groups.descriptionFormat,
    description: groups.description,
  }
}
