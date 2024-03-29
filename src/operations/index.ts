import equal from 'fast-deep-equal'
import { v4 as uuidv4 } from 'uuid';
import {
  server as defaultServer,
  ServerSession,
  ServerSessionError,
  AuthenticationError,
  HttpResponse,
  HttpError,
  Debtor,
  TransfersList,
  Transfer,
  DebtorConfig,
  Error as WebApiError,
} from './server'
import {
  db,
  UserData,
  DebtorRecordWithId,
  ActionRecordWithId,
  CreateTransferAction,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
  TransferRecord,
  RecordDoesNotExist,
  UpdateConfigActionWithId,
  ExecutionState,
  DebtorConfigData,
  ListQueryOptions,
  getCreateTransferActionStatus,
  DeleteTransferTaskWithId,
  CreateTransferActionStatus,
} from './db'
import {
  parsePaymentRequest,
  IvalidPaymentRequest,
  IvalidPaymentData,
  generatePayment0TransferNote,
} from '../payment-requests'
import { UpdateScheduler } from '../update-scheduler'
import {
  parseRootConfigData,
  InvalidRootConfigData,
  stringifyRootConfigData,
  RootConfigData,
} from '../root-config-data'
import {
  parseDebtorInfoDocument,
  InvalidDocument,
  generateCoinInfoDocument,
  BaseDebtorData,
  calcSha256,
} from '../debtor-info'
import { getDebtorIdentityFromAccountIdentity } from '../utils'

export {
  RecordDoesNotExist,
  IvalidPaymentRequest,
  IvalidPaymentData,
  AuthenticationError,
  ServerSessionError,
  getCreateTransferActionStatus,
}

export type {
  ListQueryOptions,
  DebtorRecordWithId,
  TransferRecord,
  ActionRecordWithId,
  CreateTransferAction,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
  UpdateConfigActionWithId,
  DebtorConfigData,
  CreateTransferActionStatus,
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
export async function login(server = defaultServer): Promise<void> {
  await server.login(async (login) => await login())
}

/* Logs out the user and redirects to home, never resolves. */
export async function logout(server = defaultServer): Promise<never> {
  return await server.logout()
}

/* If the user is logged in, returns an user context
 * instance. Otherise, returns `undefined`. The obtained user context
 * instance can be used to perform operations on user's behalf. */
export async function obtainUserContext(
  server = defaultServer,
  updateScheduler?: UpdateScheduler,
): Promise<UserContext | undefined> {
  let userId
  try {
    const entrypoint = await server.entrypointPromise
    if (entrypoint === undefined) {
      return undefined
    }
    userId = await getOrCreateUserId(server, entrypoint)
  } catch (e: unknown) {
    switch (true) {
      case e instanceof AuthenticationError:
      case e instanceof HttpError:
        console.error(e)
        alert('There seems to be a problem on the server. Please try again later.')
        await server.logout()
        break
      case e instanceof ServerSessionError:
        console.error(e)
        alert('A network problem has occured. Please check your Internet connection.')
        await server.logout()
        break
    }
    throw e
  }
  return new UserContext(
    server,
    updateScheduler ?? new UpdateScheduler(update.bind(undefined, server)),
    await db.getDebtorRecord(userId),
    await getDebtorConfigData(userId),
  )
}

/* Tries to update the local database, reading the latest data from
 * the server. Any network failures will be swallowed. */
export async function update(server: ServerSession): Promise<void> {
  try {
    const data = await getUserData(server)
    const userId = await db.storeUserData(data)
    await executeReadyTasks(server, userId)

  } catch (error: unknown) {
    let event
    switch (true) {
      case error instanceof AuthenticationError:
        event = new Event('update-authentication-error', { cancelable: true })
        break
      case error instanceof ServerSessionError:
        event = new Event('update-network-error', { cancelable: true })
        break
      case error instanceof HttpError:
        event = new Event('update-http-error', { cancelable: true })
        break
      default:
        throw error
    }
    if (dispatchEvent(event)) {
      console.error(error)
    }
  }
}

/* Returns the user ID corresponding to the given `entrypoint`. If the
 * user does not exist, tries to create a new user in the local
 * database, reading the user's data from the server. */
export async function getOrCreateUserId(server: ServerSession, entrypoint: string): Promise<number> {
  let userId = await db.getUserId(entrypoint)
  if (userId === undefined) {
    const userData = await getUserData(server, false)
    userId = await db.storeUserData(userData)
  }
  return userId
}

export class UserContext {
  private server: ServerSession
  private updateScheduler: UpdateScheduler
  private configUri: string
  private createTransferUri: string
  private saveDocumentUri: string
  private debtorConfigData: DebtorConfigData & { debtorInfoRevision: bigint }

  readonly debtorIdentityUri: string
  readonly publicInfoDocumentUri: string
  readonly noteMaxBytes: number
  readonly userId: number
  readonly scheduleUpdate: UpdateScheduler['schedule']
  readonly getActionRecords: (options?: ListQueryOptions) => Promise<ActionRecordWithId[]>
  readonly getTransferRecords: (options?: ListQueryOptions) => Promise<TransferRecord[]>
  readonly getTransferRecord = db.getTransferRecord.bind(db)
  readonly getCreateTransferActionStatus = getCreateTransferActionStatus
  readonly getActionRecord = db.getActionRecord.bind(db)
  readonly replaceActionRecord = db.replaceActionRecord.bind(db)

  constructor(
    server: ServerSession,
    updateScheduler: UpdateScheduler,
    debtroRecord: DebtorRecordWithId,
    debtorConfigData: UserContext['debtorConfigData'],
  ) {
    this.server = server
    this.updateScheduler = updateScheduler
    this.userId = debtroRecord.userId
    this.configUri = new URL(debtroRecord.config.uri, debtroRecord.uri).href
    this.debtorIdentityUri = new URL(debtroRecord.identity.uri, debtroRecord.uri).href
    this.createTransferUri = new URL(debtroRecord.createTransfer.uri, debtroRecord.uri).href
    this.publicInfoDocumentUri = new URL(debtroRecord.publicInfoDocument.uri, debtroRecord.uri).href
    this.saveDocumentUri = new URL(debtroRecord.saveDocument.uri, debtroRecord.uri).href
    this.noteMaxBytes = Number(debtroRecord.noteMaxBytes)
    this.debtorConfigData = debtorConfigData
    this.scheduleUpdate = this.updateScheduler.schedule.bind(this.updateScheduler)
    this.getActionRecords = db.getActionRecords.bind(db, this.userId)
    this.getTransferRecords = db.getTransferRecords.bind(db, this.userId)
  }

  /* The caller must be prepared this method to throw
   * `ServerSessionError` or `AuthenticationError`. */
  async ensureAuthenticated(): Promise<void> {
    const entrypoint = await this.server.entrypointPromise
    if (entrypoint === undefined) {
      throw new Error('undefined entrypoint')
    }
    try {
      await this.server.get(entrypoint, { attemptLogin: true })
    } catch (e: unknown) {
      if (e instanceof HttpError) throw new ServerSessionError(`unexpected status code (${e.status})`)
      else throw e
    }
  }

  async getDebtorRecord(): Promise<DebtorRecordWithId> {
    return await db.getDebtorRecord(this.userId)
  }

  getDebtorConfigData(): UserContext['debtorConfigData'] {
    return this.debtorConfigData
  }

  async editDebtorConfigData(data: DebtorConfigData): Promise<UpdateConfigActionWithId> {
    return await db.ensureUpdateConfigAction(this.userId, data)
  }

  /* Tries to perform the given update config action and remove
   * it. The caller must be prepared this method to throw
   * `ServerSessionError`, or `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async executeUpdateConfigAction(action: UpdateConfigActionWithId): Promise<void> {
    const { interestRate, debtorInfo } = action
    let configData: string | undefined

    try {
      let attemptsLeft = 10
      while (true) {
        await this.fetchDebtorConfig()
        this.debtorConfigData = await getDebtorConfigData(this.userId)
        if (!isConfigIsUpToDate(this.debtorConfigData, interestRate, debtorInfo)) {
          configData ??= stringifyRootConfigData({
            rate: interestRate,
            info: debtorInfo ? await this.createDocument(debtorInfo) : undefined,
          })
          try {
            const response = await this.server.patch(
              this.configUri,
              {
                type: 'DebtorConfig',
                latestUpdateId: (await db.getConfigRecord(this.userId)).latestUpdateId + 1n,
                configData,
              },
              { attemptLogin: true },
            ) as HttpResponse<DebtorConfig>
            await db.updateConfigRecord(this.userId, response.data)
          } catch (e: unknown) {
            if (e instanceof HttpError && e.status === 409 && attemptsLeft--) continue
            else throw e
          }
        }
        break
      }

    } catch (e: unknown) {
      if (e instanceof HttpError) throw new ServerSessionError(`unexpected status code (${e.status})`)
      else throw e
    }

    this.debtorConfigData = await getDebtorConfigData(this.userId)
    await db.replaceActionRecord(action, null)
  }

  /* Deletes the given update config action. The caller must be
   * prepared this method to throw `RecordDoesNotExist` in case of a
   * failure due to concurrent execution/deletion of the action.*/
  async deleteUpdateConfigAction(action: UpdateConfigActionWithId): Promise<void> {
    await db.replaceActionRecord(action, null)
  }

  /* Reads a payment request, and adds and returns a new
   * create transfer action. May throw `IvalidPaymentRequest`. */
  async processPaymentRequest(blob: Blob, debtorIdentityUri?: string): Promise<CreateTransferActionWithId> {
    const request = await parsePaymentRequest(blob)
    const debtorUri = getDebtorIdentityFromAccountIdentity(request.accountUri)
    if (debtorUri === undefined || debtorIdentityUri !== undefined && debtorUri !== debtorIdentityUri) {
      throw new IvalidPaymentRequest('wrong debtor URI')
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
        noteFormat: request.amount ? 'PAYMENT0' : 'payment0',
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
          const response = await this.server.post(
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

      case 'Initiated':
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

  /* Retries an unsuccessful transfer. */
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
    await db.removeActionRecord(action.actionId)
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
      const response = await this.server.post(
        action.transferUri,
        { type: 'TransferCancelationRequest' },
        { attemptLogin: true },
      ) as HttpResponse<Transfer>
      transfer = response.data
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        if (e.status === 403 || e.status === 404) return false
        throw new ServerSessionError(`unexpected status code (${e.status})`)
      }
      throw e
    }
    await db.storeTransfer(action.userId, transfer)
    return true
  }

  private async createDocument(data: BaseDebtorData): Promise<RootConfigData['info']> {
    const currentRevision = this.getDebtorConfigData().debtorInfoRevision
    const document = await generateCoinInfoDocument({
      ...data,
      debtorIdentity: { type: 'DebtorIdentity', uri: this.debtorIdentityUri },
      revision: currentRevision + 1n,
      latestDebtorInfo: { uri: this.publicInfoDocumentUri },
    })
    const response = await this.server.postDocument(
      this.saveDocumentUri,
      document.contentType,
      document.content,
      { attemptLogin: true },
    )
    const iri = response.headers.location
    assert(typeof iri === 'string', 'missing document location')
    await db.putDocumentRecord({ ...document, uri: iri, userId: this.userId })
    return {
      iri,
      contentType: document.contentType,
      sha256: document.sha256,
    }
  }

  private async fetchDebtorConfig(): Promise<void> {
    const response = await this.server.get(this.configUri, { attemptLogin: true }) as HttpResponse<DebtorConfig>
    await db.updateConfigRecord(this.userId, response.data)
    const document = await getDebtorInfoDocument(this.server, response.data.configData)
    if (document) {
      await db.putDocumentRecord({ ...document, userId: this.userId })
    }
  }
}

async function updateExecutionState(action: CreateTransferActionWithId, execution: ExecutionState): Promise<void> {
  await db.replaceActionRecord(action, { ...action, execution })
  action.execution = execution
}

async function getDebtorInfoDocument(server: ServerSession, configData: string): Promise<UserData['document']> {
  try {
    const rootConfigData = parseRootConfigData(configData)
    const uri = rootConfigData.info?.iri
    if (uri !== undefined) {
      const documentRecord = await db.getDocumentRecord(uri)
      if (documentRecord) {
        const { userId, ...document } = documentRecord
        return document
      } else {
        const { headers, data } = await server.getDocument(uri)
        return {
          uri,
          contentType: String(headers['content-type']),
          content: data,
          sha256: await calcSha256(data),
        }
      }
    }
  } catch (e: unknown) {
    if (e instanceof InvalidRootConfigData) { /* ignore */ }
    else if (e instanceof HttpError && e.status === 404) { /* ignore */ }
    else throw e
  }
  return undefined
}

function calcParallelTimeout(numberOfParallelRequests: number): number {
  const n = 6  // a rough guess for the maximum number of parallel connections
  return appConfig.serverApiTimeout * (numberOfParallelRequests + n - 1) / n
}

async function getUserData(server: ServerSession, getTransfers = true): Promise<UserData> {
  const collectedAfter = new Date()

  const debtorResponse = await server.getEntrypointResponse() as HttpResponse<Debtor>
  const debtor = { ...debtorResponse.data }

  let transferUris
  let transfers
  const transfersListUri = debtorResponse.buildUri(debtor.transfersList.uri)
  let attemptsLeft = 10
  while (true) {
    const transfersListResponse = await server.get(transfersListUri) as HttpResponse<TransfersList>
    transferUris = transfersListResponse.data.items.map(item => transfersListResponse.buildUri(item.uri))
    if (getTransfers) {
      const unconcludedTransferUris = (
        await Promise.all(transferUris.map(async uri => await db.isConcludedTransfer(uri) ? undefined : uri))
      ).filter(uri => uri !== undefined) as string[]
      const timeout = calcParallelTimeout(unconcludedTransferUris.length)
      try {
        transfers = (
          await Promise.all(unconcludedTransferUris.map(uri => server.get(uri, { timeout }))) as HttpResponse<Transfer>[]
        ).map(response => ({ ...response.data, uri: response.url } as Transfer))
      } catch (e: unknown) {
        if (e instanceof HttpError && e.status === 404 && attemptsLeft--) {
          // Normally, this can happen only if a transfer has been
          // deleted after the transfer list was obtained. In this
          // case, we should obtain the transfer list again, and
          // retry.
          continue
        } else throw e
      }
    }
    break
  }

  return {
    collectedAfter,
    debtor,
    transferUris,
    transfers,
    document: await getDebtorInfoDocument(server, debtor.config.configData),
  }
}

async function executeReadyTasks(server: ServerSession, userId: number): Promise<void> {
  const limit = 1000
  let tasks
  do {
    tasks = await db.getTasks(userId, new Date(), limit)
    let deleteTransferTasks: DeleteTransferTaskWithId[] = []
    for (const task of tasks) {
      switch (task.taskType) {
        case 'DeleteTransfer':
          deleteTransferTasks.push(task)
          break
        default:
          console.warn('Unknown task type', task)
      }
    }
    const timeout = calcParallelTimeout(deleteTransferTasks.length)
    await Promise.all(deleteTransferTasks.map(async (task) => {
      try {
        await server.delete(task.transferUri, { timeout })
      } catch (e: unknown) {
        if (!(e instanceof HttpError && e.status === 404)) throw e
      }
      await db.removeTask(task.taskId)
    }))

  } while (tasks.length >= limit)
}

async function getDebtorConfigData(userId: number): Promise<UserContext['debtorConfigData']> {
  let configRecord = await db.getConfigRecord(userId)
  let configData
  try {
    configData = parseRootConfigData(configRecord.configData)
  } catch (e: unknown) {
    if (!(e instanceof InvalidRootConfigData)) throw e
  }
  const interestRate = configData?.rate

  let debtorInfo
  let debtorInfoRevision = 0n
  if (configData?.info) {
    const document = await db.getDocumentRecord(configData.info.iri)
    if (
      document &&
      (configData.info.contentType ?? document.contentType) === document.contentType &&
      (configData.info.sha256 ?? document.sha256) === document.sha256
    ) {
      try {
        debtorInfo = await parseDebtorInfoDocument(document)
        debtorInfoRevision = debtorInfo.revision
      } catch (e: unknown) {
        if (!(e instanceof InvalidDocument)) throw e
      }
    }
  }
  return { interestRate, debtorInfo, debtorInfoRevision }
}

function isConfigIsUpToDate(
  debtorConfigData: DebtorConfigData,
  newInterestRate?: number,
  newDebtorInfo?: BaseDebtorData,
): boolean {
  const { interestRate, debtorInfo } = debtorConfigData
  const {
    summary,
    debtorName,
    debtorHomepage,
    amountDivisor,
    decimalPlaces,
    unit,
    peg,
  } = newDebtorInfo ?? {}
  return (
    interestRate === newInterestRate &&
    debtorInfo?.summary === summary &&
    debtorInfo?.debtorName === debtorName &&
    debtorInfo?.amountDivisor === amountDivisor &&
    debtorInfo?.decimalPlaces === decimalPlaces &&
    debtorInfo?.unit === unit &&
    equal(debtorInfo?.debtorHomepage, debtorHomepage) &&
    equal(debtorInfo?.peg, peg)
  )
}
