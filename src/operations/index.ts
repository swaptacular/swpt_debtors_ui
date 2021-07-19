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
  UpdateConfigActionWithId,
  ExecutionState,
  DebtorConfigData,
  getCreateTransferActionStatus,
} from './db'
import {
  parsePaymentRequest,
  IvalidPaymentRequest,
  generatePayment0TransferNote,
} from '../payment-requests'
import { UpdateScheduler } from '../update-scheduler'
import { getUserData } from './utils'
import { parseRootConfigData, InvalidRootConfigData } from '../root-config-data';
import { parseDebtorInfoDocument, InvalidDocument } from '../debtor-info';


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
    if (e instanceof ServerSessionError) console.log(e)
    else if (e instanceof HttpError) console.error(e)
    else throw e
    return
  }
  await db.storeUserData(data)
}

class UserContext {
  private updateScheduler = new UpdateScheduler(update)
  private createTransferUri: string
  private noteMaxBytes: number

  readonly userId: number
  readonly scheduleUpdate = this.updateScheduler.schedule.bind(this.updateScheduler)
  readonly getCreateTransferActionStatus = getCreateTransferActionStatus

  constructor(debtroRecord: DebtorRecordWithId) {
    this.userId = debtroRecord.userId
    this.createTransferUri = new URL(debtroRecord.createTransfer.uri, debtroRecord.uri).href
    this.noteMaxBytes = Number(debtroRecord.noteMaxBytes)
  }

  async getDebtorRecord(): Promise<DebtorRecordWithId> {
    return await db.getDebtorRecord(this.userId)
  }

  async getDebtorConfigData(): Promise<DebtorConfigData> {
    const configRecord = await db.getConfigRecord(this.userId)
    let configData
    try {
      configData = parseRootConfigData(configRecord.configData)
    } catch (e: unknown) {
      if (!(e instanceof InvalidRootConfigData)) throw e
    }
    const interestRate = configData?.rate
    let debtorInfo
    if (configData?.info) {
      const document = await db.getDocumentRecord(configData.info.iri)
      if (
        document &&
        (configData.info.contentType ?? document.contentType) === document.contentType &&
        (configData.info.sha256 ?? document.sha256) === document.sha256
      ) {
        try {
          debtorInfo = await parseDebtorInfoDocument(document)
        } catch (e: unknown) {
          if (!(e instanceof InvalidDocument)) throw e
        }
      }
    }
    return { interestRate, debtorInfo }
  }

  async editDebtorConfigData(data: DebtorConfigData): Promise<UpdateConfigActionWithId> {
    return await db.ensureUpdateConfigAction(this.userId, data)
  }

  async executeUpdateConfigAction(action: UpdateConfigActionWithId): Promise<boolean> {
    // TODO:
    return true
  }

  /* Deletes the given update config action. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteUpdateConfigAction(action: UpdateConfigActionWithId): Promise<void> {
    await db.replaceActionRecord(action, null)
  }

  /* Reads a payment request, and adds and returns a new
   * create transfer action. May throw `IvalidPaymentRequest`. */
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
      },
      requestedAmount: request.amount,
      requestedDeadline: request.deadline,
    }
    await db.createActionRecord(actionRecord)  // adds the `actionId` field
    return actionRecord as CreateTransferActionWithId
  }

  /* Tries to (re)execute the given create transfer action. If the
   * execution is successful, the given action record is deleted, and
   * a `TransferRecord` instance is returned. The caller must be
   * prepared this method to throw `ServerSessionError`,
   * `ForbiddenOperation`, `WrongTransferData`,
   * `TransferCreationTimeout`, or `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action. Note
   * that the passed `action` object will be modified according to the
   * changes occurring in the state of the action record. */
  async executeCreateTransferAction(action: CreateTransferActionWithId): Promise<TransferRecord> {
    let transferRecord

    switch (this.getCreateTransferActionStatus(action)) {
      case 'Draft':
      case 'Not confirmed':
      case 'Not sent':
        const now = Date.now()
        const { startedAt = new Date(now), unresolvedRequestAt } = action.execution ?? {}
        const requestTime = Math.max(now, (unresolvedRequestAt?.getTime() ?? -Infinity) + 1)
        await updateExecutionState(action, { startedAt, unresolvedRequestAt: new Date(requestTime) })
        try {
          const response = await server.post(
            this.createTransferUri,
            action.creationRequest,
            { attemptLogin: true },
          ) as HttpResponse<Transfer>
          const transfer = response.data
          transferRecord = await db.createTransferRecord(action, transfer)
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
        assert(transferRecord, 'missing transfer record')
        db.replaceActionRecord(action, null)
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

  /* Deletes the given create transfer action. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    await db.replaceActionRecord(action, null)
  }

  /* Retries an unsuccessful transfer. When passing an abort transfer
   * action, the caller must be prepared this method to throw
   * `RecordDoesNotExist` in case of a failure due to concurrent
   * execution/deletion of the action. */
  async retryTransfer(transferRecord: TransferRecord): Promise<CreateTransferActionWithId>
  async retryTransfer(abortTransferAction: AbortTransferActionWithId): Promise<CreateTransferActionWithId>
  async retryTransfer(param: TransferRecord | AbortTransferActionWithId): Promise<CreateTransferActionWithId> {
    const [transferRecord, abortTransferAction] = 'actionId' in param ?
      [await db.getTransferRecord(param.transferUri), param] :
      [param, undefined]
    assert(transferRecord, 'missing transfer record')

    const createTransferAction = {
      // The `actionId` field will be added automatically.
      userId: transferRecord.userId,
      actionType: 'CreateTransfer' as const,
      createdAt: new Date(),
      creationRequest: {
        type: 'TransferCreationRequest',
        recipient: transferRecord.recipient,
        amount: transferRecord.amount,
        transferUuid: uuidv4(),
        noteFormat: transferRecord.noteFormat,
        note: transferRecord.note,
      },
      paymentInfo: transferRecord.paymentInfo,
      requestedAmount: transferRecord.noteFormat === 'PAYMENT0' ? transferRecord.amount : 0n,

      // NOTE: The `requestedDeadline` field is not set, because
      // deadlines are not supported in the Web API.
    }

    if (abortTransferAction) {
      try {
        await db.replaceActionRecord(abortTransferAction, createTransferAction)
        return createTransferAction as CreateTransferActionWithId
      } catch (e: unknown) {
        if (e instanceof RecordDoesNotExist) assert(!await db.getActionRecord(abortTransferAction.actionId))
        else throw e
      }
    }
    await db.createActionRecord(createTransferAction)
    return createTransferAction as CreateTransferActionWithId
  }

  /* Dismisses an unsuccessful or delayed transfer.*/
  async dismissTransfer(action: AbortTransferActionWithId): Promise<TransferRecord> {
    try {
      await db.replaceActionRecord(action, null)
    } catch (e: unknown) {
      if (e instanceof RecordDoesNotExist) assert(!await db.getActionRecord(action.actionId))
      else throw e
    }
    const transferRecord = await db.getTransferRecord(action.transferUri)
    assert(transferRecord, 'missing transfer record')
    return transferRecord
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
    await db.storeTransfer(action.userId, transfer)
    return true
  }

}

async function updateExecutionState(action: CreateTransferActionWithId, execution: ExecutionState): Promise<void> {
  await db.replaceActionRecord(action, { ...action, execution })
  action.execution = execution
}
