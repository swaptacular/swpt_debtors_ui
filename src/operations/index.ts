import { v4 as uuidv4 } from 'uuid';
import { server, ServerSessionError, HttpResponse, HttpError, Transfer } from './server'
import {
  db,
  RecordDoesNotExist,
  DebtorRecordWithId,
  ActionRecordWithId,
  CreateTransferAction,
  TransferRecord,
} from './db'
import { parsePaymentRequest, IvalidPaymentRequest } from './payment-requests'
import { UpdateScheduler, TaskCallback } from './scheduler'
import { getUserData } from './utils'

export {
  IvalidPaymentRequest,
}

export type {
  TaskCallback,
  DebtorRecordWithId,
  ActionRecordWithId,
  CreateTransferAction,
}

export type CreateTransferActionWithId =
  & ActionRecordWithId
  & CreateTransferAction

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
  return new UserContext(await db.getDebtorRecord(userId))
}

/* Tries to update the local database, reading the latest data from
 * the server. Any network failures will be swallowed. */
async function update(): Promise<void> {
  let data
  try {
    data = await getUserData()
  } catch (e: unknown) {
    if (e instanceof ServerSessionError) {
      console.log(e)
      return
    } else throw e
  }
  await db.storeUserData(data)
}

class UserContext {
  private updateScheduler = new UpdateScheduler(update)
  private createTransferUri: string

  readonly userId: number
  readonly scheduleUpdate = this.updateScheduler.schedule.bind(this.updateScheduler)

  constructor(debtroRecord: DebtorRecordWithId) {
    this.userId = debtroRecord.userId
    this.createTransferUri = new URL(debtroRecord.createTransfer.uri, debtroRecord.uri).href
  }

  async getDebtorRecord(): Promise<DebtorRecordWithId> {
    return await db.getDebtorRecord(this.userId)
  }

  async processPaymentRequest(blob: Blob): Promise<CreateTransferActionWithId> {
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
    return actionRecord as CreateTransferActionWithId
  }

  async executeCreateTransferAction(action: CreateTransferActionWithId): Promise<TransferRecord | undefined> {
    // TODO: This approach is wrong! The CreateTransferAction should
    // be marked as executed, and then a scheduled task should make
    // sure that the request is made. In the meantime canceling should
    // not be allowed.

    let transferRecord
    if (!action.error) {
      let transfer
      try {
        const response = await server.post(
          this.createTransferUri,
          action.creationRequest,
          { attemptLogin: true },
        ) as HttpResponse<Transfer>
        transfer = response.data
      } catch (e: unknown) {
        if (e instanceof HttpError) {
          action.error = e.status === 403 ? 'forbidden operation' : 'unexpected error'
          await db.updateActionRecord(action)
          return undefined
        } else throw e
      }
      try {
        transferRecord = await db.createTransfer(action.actionId, transfer)
      } catch (e: unknown) {
        if (e instanceof RecordDoesNotExist) {
          // Looks like this `CreateTransferAction` has bee dismissed
          // before its execution has been finished. In this case, the
          // transfer will be appear as a transfer coming from another
          // device.
        }
        else throw e
      }
      if (transfer.checkupAt) {
        this.scheduleUpdate(new Date(transfer.checkupAt))
      }
    }
    return transferRecord
  }

  async dismissCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    await db.deleteActionRecord(action.actionId)
  }

}
