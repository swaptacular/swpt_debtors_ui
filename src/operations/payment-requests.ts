import { v4 as uuidv4 } from 'uuid';
import type { CreateTransferAction } from './db'

const PAYMENT_REQUEST_REGEX = /^SPR0\r?\n(?<crc>.*)\r?\n(?<accountUri>.*)\r?\n(?<payeeName>.*)\r?\n(?<amount>\d+)\r?\n(?<deadline>.*)\r?\n(?<payeeReference>.*)\r?\n(?<descriptionFormat>.*)\r?\n(?<description>[\s\S]*)$/u
const MAX_UINT64 = 2n ** 64n - 1n
const CONTENT_TYPE_SPR0 = 'application/vnd.swaptacular.spr0'

export class IvalidPaymentRequest extends Error {
  name = 'IvalidPaymentRequest'
}

export async function readPaymentRequest(userId: number, request: Blob): Promise<CreateTransferAction> {
  if (request.type && request.type !== CONTENT_TYPE_SPR0) {
    throw new IvalidPaymentRequest('wrong content type')
  }

  const regexMatch: any = (await request.text()).match(PAYMENT_REQUEST_REGEX)
  if (!regexMatch) {
    throw new IvalidPaymentRequest('parse error')
  }
  const groups = regexMatch.groups

  const amount = BigInt(groups.amount)
  if (amount > MAX_UINT64) {
    throw new IvalidPaymentRequest('invalid amount')
  }

  let deadline
  if (groups.deadline !== '') {
    deadline = new Date(groups.deadline)
    if (Number.isNaN(deadline.getTime())) {
      throw new IvalidPaymentRequest('invalid deadline')
    }
  }

  // Currently, the description can only be plain text. This is
  // indicated by an empty string in the `descriptionFormat` filed.
  if (groups.descriptionFormat !== '') {
    throw new IvalidPaymentRequest('invalid description format')
  }

  return {
    userId,
    actionType: 'CreateTransfer',
    createdAt: new Date(),
    creationRequest: {
      type: 'TransferCreationRequest',
      recipient: { uri: groups.accountUri },
      amount,
      transferUuid: uuidv4(),
      noteFormat: 'payeeref',
      note: groups.payeeReference,
    },
    paymentInfo: {
      payeeName: groups.payeeName,
      paymentRequest: {
        content: await request.arrayBuffer(),
        contentType: CONTENT_TYPE_SPR0,
      }
    }
  }
}
