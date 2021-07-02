import { v4 as uuidv4 } from 'uuid';
import {
  server,
  ServerSessionError,
  HttpResponse, HttpError,
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
  TRANSFER_DELETION_DELAY_SECONDS,
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

export class TranferCreationTimeout extends Error {
  name = 'TranferCreationTimeout'
}

export class TranferCreationError extends Error {
  name = 'TranferCreationError'
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
   * `CreateTransferAction`. May throw `IvalidPaymentRequest`. */
  async processPaymentRequest(blob: Blob): Promise<CreateTransferActionWithId> {
    const request = await parsePaymentRequest(blob)
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
      }
    }
    await db.createActionRecord(actionRecord)  // adds `actionId` field
    return actionRecord as CreateTransferActionWithId
  }

  /* Tries to execute/re-execute the given create transfer action. If
   * the execution is successful, the given action record is deleted,
   * and a `TransferRecord` instance is returned. The caller must be
   * prepared this method to throw `ServerSessionError`,
   * `ForbiddenOperation`, `TranferCreationError`,
   * `TranferCreationTimeout`, or `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action. */
  async executeCreateTransferAction(action: CreateTransferActionWithId): Promise<TransferRecord> {
    let transferRecord
    let { startedAt, result } = action.execution ?? {}
    switch (result?.ok) {
      case undefined:
        if (startedAt) {
          if (canDeleteCreateTransferAction(action)) throw new TranferCreationTimeout()
        } else {
          startedAt = new Date()
          const execution = { startedAt }
          await db.replaceActionRecord(action, { ...action, execution })
          action.execution = execution
        }
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
            switch (e.status) {
              case 403:
                throw new ForbiddenOperation()
              case 422:
                const error: WebApiError = (typeof e.data === 'object' ? e.data : null) ?? {}
                const execution = { startedAt, result: { ...error, ok: false as const } }
                await db.replaceActionRecord(action, { ...action, execution })
                action.execution = execution
                throw new TranferCreationError()
              default:
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
        throw new TranferCreationError()
    }

    if (!transferRecord.result && transferRecord.checkupAt) {
      this.scheduleUpdate(new Date(transferRecord.checkupAt))
    }
    return transferRecord
  }

  /* Deletes a failed `CreateTransferAction`. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    await db.replaceActionRecord(action)
  }

}

/* Determines if the given create transfer action can be deleted. A
 * started create transfer action can be deleted only if is has
 * failed, or timed out without initiating a transfer. */
export function canDeleteCreateTransferAction(action: CreateTransferActionWithId): boolean {
  const { startedAt, result } = action.execution ?? {}
  return (
    !startedAt ||
    result?.ok === false ||
    (!result && Date.now() - startedAt.getTime() > 1000 * (TRANSFER_DELETION_DELAY_SECONDS - 3600))
  )
}

