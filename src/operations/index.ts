import { v4 as uuidv4 } from 'uuid';
import {
  server,
  ServerSessionError,
  HttpResponse,
  HttpError,
  Transfer,
  Error as WebApiError,
} from './server'
import {
  db,
  DebtorRecordWithId,
  CreateTransferAction,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
  TransferRecord,
  RecordDoesNotExist,
  ExecutionState,
  TRANSFER_DELETION_MIN_DELAY_SECONDS,
} from './db'
import {
  parsePaymentRequest,
  IvalidPaymentRequest,
  generatePayment0TransferNote,
} from './payment-requests'
import { UpdateScheduler } from './scheduler'
import { getUserData } from './utils'

export {
  RecordDoesNotExist,
  IvalidPaymentRequest,
  ServerSessionError,
}

export type {
  DebtorRecordWithId,
  CreateTransferAction,
  CreateTransferActionWithId,
  TransferRecord,
}

export type CreateTransferActionStatus =
  | 'Draft'
  | 'Not sent'
  | 'Not confirmed'
  | 'Sent'
  | 'Failed'
  | 'Timed out'

export class TransferCreationTimeout extends Error {
  name = 'TransferCreationTimeout'
}

export class WrongTransferData extends Error {
  name = 'WrongTransferData'
}

export class ForbiddenOperation extends Error {
  name = 'ForbiddenOperation'
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
    await update(false)
    alreadyTriedToUpdate = true
  }
  return new UserContext(await db.getDebtorRecord(userId))
}

/* Tries to update the local database, reading the latest data from
 * the server. Any network failures will be swallowed. */
async function update(getTransfers = true): Promise<void> {
  let data
  try {
    data = await getUserData(getTransfers)
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
  private noteMaxBytes: number

  readonly userId: number
  readonly scheduleUpdate = this.updateScheduler.schedule.bind(this.updateScheduler)

  constructor(debtroRecord: DebtorRecordWithId) {
    this.userId = debtroRecord.userId
    this.createTransferUri = new URL(debtroRecord.createTransfer.uri, debtroRecord.uri).href
    this.noteMaxBytes = Number(debtroRecord.noteMaxBytes)
  }

  async getDebtorRecord(): Promise<DebtorRecordWithId> {
    return await db.getDebtorRecord(this.userId)
  }

  /* Reads a payment request, and adds and returns a new
   * create transfer action. May throw `IvalidPaymentRequest`. */
  async processPaymentRequest(blob: Blob): Promise<CreateTransferActionWithId> {
    const request = await parsePaymentRequest(blob)
    if (request.deadline) {
      // TODO: When working with the "Payments Web API", deadlines
      // must be allowed.
      throw new IvalidPaymentRequest('deadlines are not allowed')
    }
    const actionRecord = {
      userId: this.userId,
      actionType: 'CreateTransfer' as const,
      createdAt: new Date(),
      creationRequest: {
        type: 'TransferCreationRequest',
        recipient: { uri: request.accountUri },
        amount: request.amount,
        transferUuid: uuidv4(),
        noteFormat: request.amount === 0n ? 'payment0' : 'PAYMENT0',
        note: generatePayment0TransferNote(request, this.noteMaxBytes),
      },
      paymentInfo: {
        payeeReference: request.payeeReference,
        payeeName: request.payeeName,
        description: request.description,
      },
      requestedAmount: request.amount,
      requestedDeadline: request.deadline,
    }
    await db.createActionRecord(actionRecord)  // adds the `actionId` field
    return actionRecord as CreateTransferActionWithId
  }

  getCreateTransferActionStatus(action: CreateTransferActionWithId): CreateTransferActionStatus {
    if (!action.execution) return 'Draft'
    const { startedAt, unresolvedRequestAt, result } = action.execution
    switch (result?.ok) {
      case undefined:
        if (hasTimedOut(startedAt)) return 'Timed out'
        if (unresolvedRequestAt) return 'Not confirmed'
        return 'Not sent'
      case true:
        return 'Sent'
      case false:
        return 'Failed'
    }
  }

  /* Tries to (re)execute the given create transfer action. If the
   * execution is successful, the given action record is deleted, and
   * a `TransferRecord` instance is returned. The caller must be
   * prepared this method to throw `ServerSessionError`,
   * `ForbiddenOperation`, `WrongTransferData`,
   * `TranferCreationTimeout`, or `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action. Note
   * that the passed `action` object will be modified according to the
   * changes occurring in the state of the action record. */
  async executeCreateTransferAction(action: CreateTransferActionWithId, deleteAction = true): Promise<TransferRecord> {
    let transferRecord

    switch (this.getCreateTransferActionStatus(action)) {
      case 'Draft':
      case 'Not confirmed':
      case 'Not sent':
        const now = Date.now()
        const { startedAt = new Date(now), unresolvedRequestAt } = action.execution ?? {}
        const safetyMargin = 2 * appConfig.serverApiTimeout
        const t = Math.max(now + safetyMargin, (unresolvedRequestAt?.getTime() ?? 0) + 1)
        await updateExecutionState(action, { startedAt, unresolvedRequestAt: new Date(t) })
        try {
          const response = await server.post(
            this.createTransferUri,
            action.creationRequest,
            { attemptLogin: true },
          ) as HttpResponse<Transfer>
          const transfer = response.data
          transferRecord = await db.createTransferRecord(action, transfer, deleteAction)
        } catch (e: unknown) {
          if (e instanceof HttpError) {
            if (e.status === 422) {
              const webApiError: WebApiError = (typeof e.data === 'object' ? e.data : null) ?? {}
              await updateExecutionState(action, { startedAt, result: { ...webApiError, ok: false as const } })
              throw new WrongTransferData()
            } else {
              await updateExecutionState(action, { startedAt, unresolvedRequestAt })
              if (e.status === 403) throw new ForbiddenOperation()
              throw new ServerSessionError(`unexpected status code (${e.status})`)
            }
          } else throw e
        }
        break

      case 'Sent':
        const transferUri: string = (action.execution?.result as any).transferUri
        transferRecord = await db.getTransferRecord(transferUri)
        if (!transferRecord) throw new Error('missing transfer record')
        db.replaceActionRecord(action)
        break

      case 'Failed':
        throw new WrongTransferData()

      case 'Timed out':
        throw new TransferCreationTimeout()
    }

    if (!transferRecord.result && transferRecord.checkupAt) {
      this.scheduleUpdate(new Date(transferRecord.checkupAt))
    }
    return transferRecord
  }

  /* Updates the state of the given create transfer action. May
   * perform a network request. Note that the passed `action` object
   * will be modified according to the changes that have occurred in
   * the state of the action record.*/
  async checkCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    // TODO
  }

  /* Deletes the given create transfer action. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    await db.replaceActionRecord(action)
  }

  /* Retries an unsuccessful transfer.*/
  async retryTransfer(action: AbortTransferActionWithId): Promise<CreateTransferActionWithId> {
    try {
      return await db.retryTransfer(action.actionId)
    } catch (e: unknown) {
      if (e instanceof RecordDoesNotExist) {
        // Try to ignore this error because it can be expected.
        const transferRecord = await db.getTransferRecord(action.transferUri)
        if (!transferRecord) throw new Error('missing transfer record')
        return await db.retryTransfer(transferRecord)
      } else throw e
    }
  }

  /* Dismisses an unsuccessful or delayed transfer.*/
  async dismissTransfer(action: AbortTransferActionWithId): Promise<TransferRecord> {
    try {
      return await db.abortTransfer(action.actionId)
    } catch (e: unknown) {
      if (e instanceof RecordDoesNotExist) {
        // Try to ignore this error because it can be expected.
        const transferRecord = await db.getTransferRecord(action.transferUri)
        if (!transferRecord) throw new Error('missing transfer record')
        return transferRecord
      } else throw e
    }
  }

  /* Tries to cancel a delayed transfer. Returns whether the transfer
   * was canceled. For delayed transfers, this method should be called
   * before calling `dismissTransfer`. The caller must be prepared
   * this method to throw `ServerSessionError`.*/
  async cancelTransfer(action: AbortTransferActionWithId): Promise<boolean> {
    let transfer
    try {
      const response = await server.post(
        action.transferUri,
        { type: 'TransferCancelationRequest' },
        { attemptLogin: true },
      ) as HttpResponse<Transfer>
      transfer = response.data
    } catch (e: unknown) {
      if (e instanceof HttpError && (e.status === 403 || e.status === 404)) return false
      throw e
    }
    await db.putTransferRecord(action.userId, transfer)
    return true
  }

}

function hasTimedOut(startedAt: Date): boolean {
  const safetyMargin = 2 * appConfig.serverApiTimeout + 3_600_000  // at least 1 hour
  return Date.now() + safetyMargin > startedAt.getTime() + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS
}

async function updateExecutionState(action: CreateTransferActionWithId, execution: ExecutionState): Promise<void> {
  await db.replaceActionRecord(action, { ...action, execution })
  action.execution = execution
}
