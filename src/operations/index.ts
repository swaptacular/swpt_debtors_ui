import { v4 as uuidv4 } from 'uuid';
import { server, ServerSessionError } from './server'
import {
  db,
  DebtorRecordWithId,
  ActionRecordWithId,
  CreateTransferAction,
} from './db'
import { parsePaymentRequest, IvalidPaymentRequest } from './payment-requests'
import { UpdateScheduler, TaskCallback } from './scheduler'
import { getUserInstallationData } from './utils'

export {
  IvalidPaymentRequest,
}

export type {
  TaskCallback,
  DebtorRecordWithId,
  ActionRecordWithId,
  CreateTransferAction,
}

/* If the user is logged in -- does nothing. Otherwise, redirects to
 * the login page, and never resolves. */
export async function login(): Promise<void> {
  await server.login(async (login) => await login())
}

/* Logs out the user and redirects to home, never resolves. */
export async function logout(): Promise<never> {
  return await server.logout()
}

/* If the user is logged in, returns an user context
 * instance. Otherise, returns `undefined`. The obtained user context
 * instance can be used to perform operations on user's behalf. */
export async function obtainUserContext(): Promise<UserContext | undefined> {
  const entrypoint = await server.entrypointPromise
  if (entrypoint === undefined) {
    return undefined
  }
  let alreadyTriedToUpdate = false
  let userId
  while ((userId = await db.getUserId(entrypoint)) === undefined) {
    if (alreadyTriedToUpdate) {
      await logout()
    }
    await update()
    alreadyTriedToUpdate = true
  }
  return new UserContext(userId)
}

/* Tries to update the local database, reading the latest data from
 * the server. Any network failures will be swallowed. */
async function update(): Promise<void> {
  let data
  try {
    data = await getUserInstallationData()
  } catch (e: unknown) {
    if (e instanceof ServerSessionError) {
      return
    } else throw e
  }
  await db.storeUserData(data)
}

class UserContext {
  private updateScheduler = new UpdateScheduler(update)

  readonly userId: number
  readonly scheduleUpdate = this.updateScheduler.schedule.bind(this.updateScheduler)

  constructor(userId: number) {
    this.userId = userId
  }

  async getDebtorRecord(): Promise<DebtorRecordWithId> {
    return await db.getDebtorRecord(this.userId)
  }

  async processPaymentRequest(blob: Blob): Promise<ActionRecordWithId & CreateTransferAction> {
    const request = await parsePaymentRequest(blob)  // may throw `IvalidPaymentRequest`
    const actionRecord = {
      userId: this.userId,
      actionType: 'CreateTransfer' as const,
      createdAt: new Date(),
      creationRequest: {
        type: 'TransferCreationRequest',
        recipient: { uri: request.accountUri },
        amount: request.amount,
        transferUuid: uuidv4(),
        noteFormat: 'payeeref',
        note: request.payeeReference,
      },
      paymentInfo: {
        payeeName: request.payeeName,
        paymentRequest: new Blob([blob], { type: request.contentType }),
      }
    }
    await db.createActionRecord(actionRecord)  // This adds actionId to `actionRecord`.
    return actionRecord as ActionRecordWithId & CreateTransferAction
  }

}
