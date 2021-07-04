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
  TransferRecord,
  RecordDoesNotExist,
  ExecutionState,
  TRANSFER_DELETION_MIN_DELAY_SECONDS,
} from './db'
import { parsePaymentRequest, IvalidPaymentRequest, generatePayment0TransferNote } from './payment-requests'
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

  /* Determines whether the given create transfer action can be
   * (re)executed. */
  canExecuteCreateTransferAction(action: CreateTransferActionWithId): boolean {
    return action.execution?.result?.ok !== false
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
  async executeCreateTransferAction(action: CreateTransferActionWithId): Promise<TransferRecord> {
    let transferRecord
    const { result, unresolvedRequestAt: previousUnresolvedRequestAt } = action.execution ?? {}
    switch (result?.ok) {
      case undefined:
        const t = Date.now()
        const startedAt = action.execution?.startedAt ?? new Date(t)
        if (hasTimedOut(startedAt)) {
          throw new TransferCreationTimeout()
        }
        const safetyMargin = 2 * appConfig.serverApiTimeout
        await updateExecutionState(action, { startedAt, unresolvedRequestAt: new Date(t + safetyMargin) })
        try {
          const response = await server.post(
            this.createTransferUri,
            action.creationRequest,
            { attemptLogin: true },
          ) as HttpResponse<Transfer>
          const transfer = response.data
          transfer.uri = response.buildUri(transfer.uri)
          transferRecord = await db.createTransferRecord(action, transfer)
        } catch (e: unknown) {
          if (e instanceof HttpError) {
            if (e.status === 422) {
              const webApiError: WebApiError = (typeof e.data === 'object' ? e.data : null) ?? {}
              await updateExecutionState(action, { startedAt, result: { ...webApiError, ok: false as const } })
              throw new WrongTransferData()
            } else {
              await updateExecutionState(action, { startedAt, unresolvedRequestAt: previousUnresolvedRequestAt })
              if (e.status === 403) throw new ForbiddenOperation()
              throw new ServerSessionError(`unexpected status code (${e.status})`)
            }
          } else throw e
        }
        break

      case true:
        transferRecord = await db.transfers.get(result.transferUri)
        if (!transferRecord) throw new Error('missing transfer record')
        db.actions.delete(action.actionId)
        break

      case false:
        throw new WrongTransferData()
    }

    if (!transferRecord.result && transferRecord.checkupAt) {
      this.scheduleUpdate(new Date(transferRecord.checkupAt))
    }
    return transferRecord
  }

  /* Determines whether the given create transfer action can be safely
   * deleted. A started create transfer action can be safely deleted
   * only if it has failed, or timed out without initiating a
   * transfer. */
  canDeleteCreateTransferAction(action: CreateTransferActionWithId): boolean {
    // TODO: Make this function smarter. For example, if the latest
    // attempt (POST-request) to create the transfer has been
    // performed some time (like 1 hour) before the latest successful
    // update, and still there is no corresponding transfer record, it
    // is probably safe to delete.
    const { startedAt, result } = action.execution ?? {}
    return (
      !startedAt ||
      result?.ok === false ||
      (!result && hasTimedOut(startedAt))
    )
  }

  /* Deletes the given create transfer action. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    await db.replaceActionRecord(action)
  }

}

function hasTimedOut(startedAt: Date): boolean {
  const safetyMargin = 3_600_000  // 1 hour
  return Date.now() + safetyMargin > startedAt.getTime() + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS
}

async function updateExecutionState(action: CreateTransferActionWithId, execution: ExecutionState): Promise<void> {
  await db.replaceActionRecord(action, { ...action, execution })
  action.execution = execution
}
