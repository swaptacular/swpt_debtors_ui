import { v4 as uuidv4 } from 'uuid';
import { server, ServerSessionError, HttpResponse, HttpError, Transfer } from './server'
import {
  db,
  DebtorRecordWithId,
  CreateTransferAction,
  CreateTransferActionWithId,
  TransferRecord,
  RecordDoesNotExist,
} from './db'
import { parsePaymentRequest, IvalidPaymentRequest, generatePayeerefTransferNote } from './payment-requests'
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
        noteFormat: 'payeeref',
        note: generatePayeerefTransferNote(request, this.noteMaxBytes),
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

  /* Tries to execute/re-execute the given `CreateTransferAction`. When
   * the execution has been successful -- returns a `TransferRecord`
   * instance. When the execution has failed -- returns
   * `undefined`. The caller must be prepared this method to throw
   * `ServerSessionError` in case of a network error, and
   * `RecordDoesNotExist` in case of a failure due to concurrent
   * execution/deletion of the action. In both cases the transfer may,
   * or may not, be successfully sent to the server. */
  async executeCreateTransferAction(action: CreateTransferActionWithId): Promise<TransferRecord | undefined> {

    // (Re)start the execution of the action if necessary.
    let { startedAt, error } = action.execution ?? {}
    if (!startedAt || error) {
      startedAt = new Date()
      const startedAction = { ...action, execution: { startedAt } }
      await db.replaceActionRecord(action, startedAction)
      action = startedAction
    }

    // Make a request to the server.
    let response
    try {
      response = await server.post(
        this.createTransferUri,
        action.creationRequest,
        { attemptLogin: true },
      ) as HttpResponse<Transfer>
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        error = e.status === 403 ? 'forbidden operation' : 'unexpected error'
        await db.replaceActionRecord(action, { ...action, execution: { startedAt, error } })
        return undefined
      } else throw e
    }

    // Create a new transfer record.
    const transfer = response.data
    const transferRecord = await db.createTransferRecord(action, transfer)
    if (transfer.checkupAt) {
      this.scheduleUpdate(new Date(transfer.checkupAt))
    }

    return transferRecord
  }

  /* Deletes a failed `CreateTransferAction`. Note that the passed
   * `action` should either be failed, or never started. The caller
   * must be prepared this method to throw `RecordDoesNotExist` in
   * case of a failure due to concurrent execution/deletion of the
   * action.*/
  async deleteCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    const { startedAt, error } = action.execution ?? {}
    if (startedAt && !error) {
      throw new Error('Can not delete started but unfinished create transfer action.')
    }
    await db.replaceActionRecord(action)
  }

}
