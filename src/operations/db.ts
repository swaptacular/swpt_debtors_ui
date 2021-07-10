import { v4 as uuidv4 } from 'uuid';
import equal from 'fast-deep-equal'
import Dexie from 'dexie'
import type {
  ObjectReference as ResourceReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
  Error as WebApiError,
} from '../web-api-schemas'
import { PaymentInfo, parseTransferNote } from './payment-requests'

type ListQueryOptions = {
  before?: number,
  after?: number,
  limit?: number,
  latestFirst?: boolean,
}

type UserReference = {
  userId: number,
}

type DocumentUri = string

type ConfigData = {
  // TODO: this is probably wrong.
  rate: number,
  info: DocumentUri | Blob,
}

type ActionData =
  & UserReference
  & {
    actionId?: number,
    actionType: string,
    createdAt: Date,
  }

export type UserData = {
  collectedAfter: Date,
  debtor: Debtor,
  transferUris: string[],
  transfers?: Transfer[],
  document?: ResourceReference & { content: Blob },
}

export type DebtorRecord =
  & Partial<UserReference>
  & Omit<Debtor, 'config'>
  & { config: ResourceReference }

export type DebtorRecordWithId =
  & DebtorRecord
  & UserReference

export type ConfigRecord =
  & UserReference
  & DebtorConfig

export type TransferRecord =
  & UserReference
  & Transfer
  & {
    time: number,
    paymentInfo: PaymentInfo,
    aborted?: true,
    originatesHere?: true,
  }

export type DocumentRecord =
  & UserReference
  & ResourceReference
  & { content: Blob }

export type ActionRecord =
  | UpdateConfigAction
  | CreateTransferAction
  | AbortTransferAction

export type ActionRecordWithId =
  & ActionRecord
  & { actionId: number }

export type UpdateConfigAction =
  & ActionData
  & ConfigData
  & { actionType: 'UpdateConfig' }

export type ExecutionState = {
  startedAt: Date,
  unresolvedRequestAt?: Date,
  result?: { ok: true, transferUri: string } | { ok: false } & WebApiError,
}

export type CreateTransferAction =
  & ActionData
  & {
    actionType: 'CreateTransfer',
    creationRequest: TransferCreationRequest,
    paymentInfo: PaymentInfo,
    requestedAmount: bigint,
    requestedDeadline?: Date,
    execution?: ExecutionState,
  }

export type CreateTransferActionWithId =
  & ActionRecordWithId
  & CreateTransferAction

export type CreateTransferActionStatus =
  | 'Draft'
  | 'Not sent'
  | 'Not confirmed'
  | 'Sent'
  | 'Failed'
  | 'Timed out'

export type AbortTransferAction =
  & ActionData
  & {
    actionType: 'AbortTransfer',
    transferUri: string,
  }

export type AbortTransferActionWithId =
  & ActionRecordWithId
  & AbortTransferAction

export type TaskData =
  & UserReference
  & {
    taskId?: number,
    taskType: string,
    scheduledFor: Date,
  }

export type TaskRecord =
  | DeleteTransferTask

export type TaskRecordWithId =
  & TaskRecord
  & { taskId: number }

export type DeleteTransferTask =
  & TaskData
  & {
    taskType: 'DeleteTransfer',
    transferUri: string,
  }

export class RecordDoesNotExist extends Error {
  name = 'RecordDoesNotExist'
}

const MAX_PROCESSING_DELAY_MILLISECONDS = 3_600_000  // 1 hour, to be on the safe side
const TRANSFER_WAIT_SECONDS = 86400  // 24 hours before the transfer is considered delayed.
const TRANSFER_DELETION_MIN_DELAY_SECONDS = 5 * 86400  // 5 days
const TRANSFER_DELETION_DELAY_SECONDS = Math.max(
  appConfig.TransferDeletionDelaySeconds, TRANSFER_DELETION_MIN_DELAY_SECONDS)

function getTransferState(transfer: Transfer): 'waiting' | 'delayed' | 'successful' | 'unsuccessful' {
  const result = transfer.result
  if (result === undefined) {
    const initiatedAt = new Date(transfer.initiatedAt)
    const deadline = new Date(initiatedAt.getTime() + 1000 * TRANSFER_WAIT_SECONDS)
    const now = new Date()
    return now <= deadline ? 'waiting' : 'delayed'

  } else if (result.committedAmount === 0n) {
    return 'unsuccessful'

  } else {
    return 'successful'
  }
}

function hasTimedOut(startedAt: Date, currentTime: number = Date.now()): boolean {
  const safetyMargin = 2 * appConfig.serverApiTimeout + MAX_PROCESSING_DELAY_MILLISECONDS
  return currentTime + safetyMargin > startedAt.getTime() + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS
}

export function isConcludedTransfer(transferRecord: TransferRecord): boolean {
  return transferRecord.result !== undefined || transferRecord.aborted === true
}

export function getCreateTransferActionStatus(
  action: CreateTransferAction,
  currentTime: number = Date.now()
): CreateTransferActionStatus {
  if (action.execution === undefined) return 'Draft'
  const { startedAt, unresolvedRequestAt, result } = action.execution
  switch (result?.ok) {
    case undefined:
      if (hasTimedOut(startedAt, currentTime)) return 'Timed out'
      if (unresolvedRequestAt) return 'Not confirmed'
      return 'Not sent'
    case true:
      return 'Sent'
    case false:
      return 'Failed'
  }
}

class DebtorsDb extends Dexie {
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<ConfigRecord, string>
  transfers: Dexie.Table<TransferRecord, string>
  documents: Dexie.Table<DocumentRecord, string>
  actions: Dexie.Table<ActionRecord, number>
  tasks: Dexie.Table<TaskRecord, number>

  constructor() {
    super('debtors')

    this.version(1).stores({
      debtors: '++userId,&uri',
      configs: 'uri,&userId',

      // Here '[userId+time],&uri' would probably be a bit more
      // efficient, because the records would be ordered physically in
      // the same way as they are normally queried. The problem is
      // that it seems "fake-indexeddb", which we use for testing,
      // does not support compound primary keys.
      transfers: 'uri,&[userId+time]',

      documents: 'uri,userId',
      actions: '++actionId,&[userId+actionId],creationRequest.transferUuid,transferUri',
      tasks: '++taskId,[userId+scheduledFor]',
    })

    this.debtors = this.table('debtors')
    this.configs = this.table('configs')
    this.transfers = this.table('transfers')
    this.documents = this.table('documents')
    this.actions = this.table('actions')
    this.tasks = this.table('tasks')
  }

  async getUserId(debtorUri: string): Promise<number | undefined> {
    return (await this.debtors.where({ uri: debtorUri }).primaryKeys())[0]
  }

  async uninstallUser(userId: number): Promise<void> {
    await this.transaction('rw', this.allTables, async () => {
      for (const table of this.allTables) {
        await table.where({ userId }).delete()
      }
    })
  }

  async getDebtorRecord(userId: number): Promise<DebtorRecordWithId> {
    const debtorRecord = await this.debtors.get(userId)
    if (!debtorRecord) {
      throw new RecordDoesNotExist(`DebtorRecord(userId=${userId})`)
    }
    return debtorRecord as DebtorRecordWithId
  }

  async getConfigRecord(userId: number): Promise<ConfigRecord> {
    const configRecord = await this.configs.where({ userId }).first()
    if (!configRecord) {
      throw new RecordDoesNotExist(`ConfigRecord(userId=${userId})`)
    }
    return configRecord
  }

  async updateConfig(actionId: number, debtorConfig: DebtorConfig): Promise<ConfigRecord> {
    return await this.transaction('rw', [this.configs, this.actions], async () => {
      const actionRecord = await this.actions.get(actionId)
      if (!(actionRecord && actionRecord.actionType === 'UpdateConfig')) {
        throw new RecordDoesNotExist(`ActionRecord(actionId=${actionId}, actionType="UpdateConfig")`)
      }
      await this.actions.delete(actionId)
      const userId = actionRecord.userId
      let configRecord = await this.getConfigRecord(userId)
      if (configRecord.uri !== debtorConfig.uri) {
        throw new Error('Can not alter the URI of an existing config record.')
      }
      if (configRecord.latestUpdateId < debtorConfig.latestUpdateId) {
        configRecord = { ...debtorConfig, userId }
        await this.configs.put(configRecord)
      }
      return configRecord
    })
  }

  async getTransferRecords(userId: number, options: ListQueryOptions = {}): Promise<TransferRecord[]> {
    const { before = Dexie.maxKey, after = Dexie.minKey, limit = 1e9, latestFirst = true } = options
    let collection = this.transfers
      .where('[userId+time]')
      .between([userId, after], [userId, before], false, false)
      .limit(limit)
    if (latestFirst) {
      collection = collection.reverse()
    }
    return await collection.toArray()
  }

  async getTransferRecord(uri: string): Promise<TransferRecord | undefined> {
    return await this.transfers.get(uri)
  }

  async createTransferRecord(
    action: CreateTransferActionWithId,
    transfer: Transfer,
    deleteAction = true,
  ): Promise<TransferRecord> {
    return await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
      const { actionId, userId } = action
      const existing = await this.actions.get(actionId)
      if (!equal(existing, action)) {
        throw new RecordDoesNotExist()
      }
      const transferRecord = await this.putTransferRecord(userId, transfer)
      if (deleteAction) {
        await this.actions.delete(actionId)
      }
      return transferRecord
    })
  }

  async abortTransfer(actionId: number): Promise<TransferRecord> {
    return await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
      const actionRecord = await this.actions.get(actionId)
      if (!(actionRecord && actionRecord.actionType === 'AbortTransfer')) {
        throw new RecordDoesNotExist()
      }
      const { userId, transferUri } = actionRecord
      await this.actions.delete(actionId)

      let transferRecord = await this.transfers.get(transferUri)
      if (!(transferRecord && transferRecord.userId === userId)) {
        throw new Error('missing transfer record')
      }

      // Unless the transfer turned out to be successful, mark the
      // transfer as aborted, and schedule its deletion as soon as
      // possible.
      if (!transferRecord.result?.committedAmount) {
        transferRecord.aborted = true
        await this.transfers.put(transferRecord)
        const initiationTime = new Date(transferRecord.initiatedAt).getTime() || Date.now()
        await this.tasks.put({
          userId,
          taskType: 'DeleteTransfer',
          scheduledFor: new Date(initiationTime + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS),
          transferUri,
        })
      }
      return transferRecord
    })
  }

  async retryTransfer(actionId: number): Promise<CreateTransferActionWithId>
  async retryTransfer(transferRecord: TransferRecord): Promise<CreateTransferActionWithId>
  async retryTransfer(param: number | TransferRecord): Promise<CreateTransferActionWithId> {
    if (typeof param === 'number') {
      const actionId = param
      return await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
        const transferRecord = await this.abortTransfer(actionId)
        return await this.retryTransfer(transferRecord)
      })

    } else {
      const transferRecord = param
      const createTransferAction = {
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
        // TODO: When working with the "Payments Web API", the
        // `requestedDeadline` field must be restored too.
      }
      await db.createActionRecord(createTransferAction)  // adds the `actionId` field
      return createTransferAction as CreateTransferActionWithId
    }
  }

  async getActionRecords(userId: number, options: ListQueryOptions = {}): Promise<ActionRecordWithId[]> {
    const { before = Dexie.maxKey, after = Dexie.minKey, limit = 1e9, latestFirst = true } = options
    let collection = this.actions
      .where('[userId+actionId]')
      .between([userId, after], [userId, before], false, false)
      .limit(limit)
    if (latestFirst) {
      collection = collection.reverse()
    }
    return await collection.toArray() as ActionRecordWithId[]
  }

  async getActionRecord(actionId: number): Promise<ActionRecordWithId | undefined> {
    return await this.actions.get(actionId) as ActionRecordWithId | undefined
  }

  /* Creates a new `ActionRecord` and returns its `actionId`. Note
   * that the passed `action` object should not have an `actionId`
   * field, and it will be added automatically. */
  async createActionRecord(action: ActionRecord & { actionId?: undefined }): Promise<number> {
    return await this.transaction('rw', [this.debtors, this.actions], async () => {
      const userId = action.userId
      if (!await this.isInstalledUser(userId)) {
        throw new RecordDoesNotExist(`DebtorRecord(userId=${userId})`)
      }
      return await this.actions.add(action)
    })
  }

  /* Depending on the passed `replacement` value -- replaces, updates,
   * or deletes the original action record. Returns the actionId of
   * the replacement. Note that an `actionId` field will be added to
   * the passed `replacement` object if it does not have one. */
  async replaceActionRecord(original: ActionRecordWithId, replacement?: ActionRecord): Promise<number | undefined> {
    return await this.transaction('rw', this.actions, async () => {
      const { actionId, userId } = original
      const existing = await this.actions.get(actionId)
      if (!equal(existing, original)) {
        throw new RecordDoesNotExist()
      }
      if (replacement === undefined) {
        await this.actions.delete(actionId)
      } else if (replacement.userId !== userId) {
        throw new Error('can not alter userId')
      } else if (replacement.actionId === undefined) {
        await this.actions.delete(actionId)
        await this.actions.add(replacement)
      } else if (replacement.actionId !== actionId) {
        throw new Error('can not alter actionId')
      } else {
        await this.actions.put(replacement)
      }
      return replacement?.actionId
    })
  }

  async getDocumentRecord(uri: string): Promise<DocumentRecord | undefined> {
    return await this.documents.get(uri)
  }

  async storeUserData(data: UserData): Promise<number> {
    return await this.transaction('rw', this.allTables, async () => {
      const userId = await this.storeDebtorAndConfigRecords(data)
      await this.deleteIrrelevantAbortTransferActions(userId, data)
      await this.storeTransferRecords(userId, data)
      return userId
    })
  }

  async putTransferRecord(userId: number, transfer: Transfer): Promise<TransferRecord> {
    return await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
      let transferRecord
      const { uri: transferUri, transferUuid, initiatedAt, result } = transfer
      const existingTransferRecord = await this.transfers.get(transferUri)

      if (existingTransferRecord) {
        if (userId !== existingTransferRecord.userId) {
          throw new Error('Can not alter the userId of an existing transfer record.')
        }
        const { time, paymentInfo, originatesHere, aborted } = existingTransferRecord
        transferRecord = { ...transfer, userId, time, paymentInfo, originatesHere, aborted }
        await this.transfers.put(transferRecord)

      } else {
        let time = new Date(initiatedAt).getTime() || Date.now()
        const paymentInfo = parseTransferNote(transfer)
        const originatesHere = (
          await this.actions
            .where({ 'creationRequest.transferUuid': transferUuid })
            .filter(action => action.actionType === 'CreateTransfer')
            .modify((action: CreateTransferAction) => {
              const startedAt = action.execution?.startedAt ?? new Date(time)
              const result = { ok: true, transferUri }
              action.execution = { startedAt, result }
            })
        ) > 0 ? true as const : undefined
        while (true) {
          try {
            transferRecord = { ...transfer, userId, time, paymentInfo, originatesHere }
            await this.transfers.put(transferRecord)
            break
          } catch (e: unknown) {
            if (!(e instanceof Dexie.ConstraintError)) throw e
            time *= (1 + Number.EPSILON)
          }
        }
      }

      if (result?.committedAmount) {
        const finalizationTime = new Date(result.finalizedAt).getTime() || Date.now()
        await this.tasks.put({
          userId,
          taskType: 'DeleteTransfer',
          scheduledFor: new Date(finalizationTime + 1000 * TRANSFER_DELETION_DELAY_SECONDS),
          transferUri,
        })
      }

      return transferRecord
    })
  }

  private async isInstalledUser(userId: number): Promise<boolean> {
    return await this.debtors.where({ userId }).count() === 1
  }

  private async isConcludedTransfer(uri: string): Promise<boolean> {
    const transferRecord = await this.transfers.get(uri)
    return Boolean(transferRecord && isConcludedTransfer(transferRecord))
  }

  private get allTables() {
    return [this.debtors, this.configs, this.transfers, this.documents, this.actions, this.tasks]
  }

  private async storeDebtorAndConfigRecords(data: UserData): Promise<number> {
    const { debtor, document } = data
    const config = debtor.config
    let userId = await this.getUserId(debtor.uri)
    if (userId === undefined) {
      userId = await this.debtors.add({ ...debtor, config: { uri: config.uri } })
    }
    const existingConfigRecord = await this.configs.where({ userId }).first()
    if (!(existingConfigRecord && existingConfigRecord.latestUpdateId > config.latestUpdateId)) {
      await this.debtors.put({ ...debtor, userId, config: { uri: config.uri } })
    }
    if (!(existingConfigRecord && existingConfigRecord.latestUpdateId >= config.latestUpdateId)) {
      const uri = new URL(config.uri, debtor.uri).href
      await this.configs.put({ ...config, userId, uri })
      if (document) {
        await this.documents.put({ ...document, userId })
      }
    }
    return userId
  }

  private async deleteIrrelevantAbortTransferActions(userId: number, data: UserData): Promise<void> {
    const uris = new Set(data.transferUris)
    await this.actions
      .where({ userId })
      .filter(action => action.actionType === 'AbortTransfer' && !uris.has(action.transferUri))
      .delete()
  }

  private async storeTransferRecords(userId: number, data: UserData): Promise<void> {
    if (data.transfers) {
      for (const transfer of data.transfers) {
        const transferUri = transfer.uri
        if (!await this.isConcludedTransfer(transferUri)) {
          await this.putTransferRecord(userId, transfer)
          const abortTransferRecordQuery = this.actions
            .where({ transferUri })
            .filter(action => action.userId === userId && action.actionType === 'AbortTransfer')
          switch (getTransferState(transfer)) {
            case 'successful':
              // If a delayed transfer turned out to be succcessful,
              // its corresponding abort transfer action must be
              // deleted.
              await abortTransferRecordQuery.delete()
              break
            case 'delayed':
            case 'unsuccessful':
              // For troubled transfers, make sure a corresponding
              // abort transfer action does exist.
              await abortTransferRecordQuery.first() || await this.actions.add({
                userId,
                transferUri,
                actionType: 'AbortTransfer',
                createdAt: new Date(),
              })
              break
          }
        }
      }
      this.resolveOldNotConfirmedCreateTransferRequests(userId, data)
    }
  }

  private async resolveOldNotConfirmedCreateTransferRequests(userId: number, data: UserData): Promise<void> {
    const currentTime = Date.now()
    const cutoffTime = data.collectedAfter.getTime() - MAX_PROCESSING_DELAY_MILLISECONDS
    await this.actions
      .where('[userId+actionId]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .filter(action => (
        action.actionType === 'CreateTransfer' &&
        getCreateTransferActionStatus(action, currentTime) === 'Not confirmed' &&
        action.execution!.unresolvedRequestAt!.getTime() < cutoffTime
      ))
      .modify((action: { execution: ExecutionState }) => {
        delete action.execution.unresolvedRequestAt
      })
  }

}

export const db = new DebtorsDb()
