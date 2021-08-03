import equal from 'fast-deep-equal'
import { Dexie, Collection } from 'dexie'
import type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
  Error as WebApiError,
} from '../web-api-schemas'
import { PaymentInfo, parseTransferNote } from '../payment-requests'
import type { ResourceReference, DocumentWithHash, BaseDebtorData } from '../debtor-info'

type UserReference = {
  userId: number,
}

type ActionData =
  & UserReference
  & {
    actionId?: number,
    actionType: string,
    createdAt: Date,
  }

export type ListQueryOptions = {
  before?: number,
  after?: number,
  limit?: number,
  latestFirst?: boolean,
}

export type UserData = {
  collectedAfter: Date,
  debtor: Debtor,
  transferUris: string[],
  transfers?: Transfer[],
  document?: ResourceReference & DocumentWithHash,
}

export type DebtorConfigData = {
  interestRate?: number,
  debtorInfo?: BaseDebtorData,
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
    aborted: boolean,
    originatesHere: boolean,
  }

export type DocumentRecord =
  & UserReference
  & ResourceReference
  & DocumentWithHash

export type ActionRecord =
  | UpdateConfigAction
  | CreateTransferAction
  | AbortTransferAction

export type ActionRecordWithId =
  & ActionRecord
  & { actionId: number }

export type UpdateConfigAction =
  & ActionData
  & DebtorConfigData
  & { actionType: 'UpdateConfig' }

export type UpdateConfigActionWithId =
  & ActionRecordWithId
  & UpdateConfigAction

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
    transfer: TransferRecord,
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

export type DeleteTransferTaskWithId =
  & TaskRecordWithId
  & DeleteTransferTask

export class UserDoesNotExist extends Error {
  name = 'UserDoesNotExist'
}

export class RecordDoesNotExist extends Error {
  name = 'RecordDoesNotExist'
}

const MAX_PROCESSING_DELAY_MILLISECONDS = 2 * appConfig.serverApiTimeout + 3_600_000  // to be on the safe side
const TRANSFER_NORMAL_WAIT_SECONDS = 86400  // 24 hours before the transfer is considered delayed.
const TRANSFER_DELETION_MIN_DELAY_SECONDS = 5 * 86400  // 5 days
const TRANSFER_DELETION_DELAY_SECONDS = Math.max(
  appConfig.TransferDeletionDelaySeconds, TRANSFER_DELETION_MIN_DELAY_SECONDS)

function hasTimedOut(startedAt: Date, currentTime: number = Date.now()): boolean {
  const deadline = startedAt.getTime() + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS
  return currentTime + MAX_PROCESSING_DELAY_MILLISECONDS > deadline
}

function getTransferState(transfer: Transfer): 'waiting' | 'delayed' | 'successful' | 'unsuccessful' {
  switch (transfer.result?.committedAmount) {
    case undefined:
      const initiatedAt = new Date(transfer.initiatedAt)
      const delayThreshold = new Date(initiatedAt.getTime() + 1000 * TRANSFER_NORMAL_WAIT_SECONDS)
      const now = new Date()
      return now <= delayThreshold ? 'waiting' : 'delayed'
    case 0n:
      return 'unsuccessful'
    default:
      return 'successful'
  }
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

  async clearAllTables(): Promise<void> {
    await this.transaction('rw', this.allTables, async () => {
      for (const table of this.allTables) {
        await table.clear()
      }
    })
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
      throw new UserDoesNotExist()
    }
    return debtorRecord as DebtorRecordWithId
  }

  async getConfigRecord(userId: number): Promise<ConfigRecord> {
    const configRecord = await this.configs.where({ userId }).first()
    if (!configRecord) {
      throw new UserDoesNotExist()
    }
    return configRecord
  }

  async updateConfigRecord(userId: number, debtorConfig: DebtorConfig): Promise<ConfigRecord> {
    return await this.transaction('rw', this.configs, async () => {
      let configRecord = await this.getConfigRecord(userId)
      assert(configRecord.uri === debtorConfig.uri, 'wrong config record URI')
      if (configRecord.latestUpdateId < debtorConfig.latestUpdateId) {
        configRecord = { ...debtorConfig, userId }
        await this.configs.put(configRecord)
      }
      return configRecord
    })
  }

  async getDocumentRecord(uri: string): Promise<DocumentRecord | undefined> {
    return await this.documents.get(uri)
  }

  async putDocumentRecord(documentRecord: DocumentRecord): Promise<void> {
    await this.transaction('rw', [this.debtors, this.documents], async () => {
      if (!await this.isInstalledUser(documentRecord.userId)) {
        throw new UserDoesNotExist()
      }
      const existingDocumentRecord = await this.documents.get(documentRecord.uri)
      assert(!existingDocumentRecord || existingDocumentRecord.userId === documentRecord.userId, 'wrong userId')
      await this.documents.put(documentRecord)
    })
  }

  async getTasks(userId: number, scheduledFor: Date = new Date(), limit = 1e9): Promise<TaskRecordWithId[]> {
    let collection = this.tasks
      .where('[userId+scheduledFor]')
      .between([userId, Dexie.minKey], [userId, scheduledFor], false, true)
      .limit(limit)
    return await collection.toArray() as TaskRecordWithId[]
  }

  async removeTask(taskId: number): Promise<void> {
    await this.tasks.delete(taskId)
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
  async createActionRecord(action: ActionRecord): Promise<number> {
    if (action.actionId !== undefined) throw new Error('actionId must be undefined')
    return await this.transaction('rw', [this.debtors, this.actions], async () => {
      if (!await this.isInstalledUser(action.userId)) {
        throw new UserDoesNotExist()
      }
      return await this.actions.add(action)
    })
  }

  /* Creates a new update config action for the given user, but only
   * if an update config action does not exist already for the
   * user. */
  async ensureUpdateConfigAction(userId: number, data: DebtorConfigData): Promise<UpdateConfigActionWithId> {
    return await this.transaction('rw', [this.debtors, this.actions], async () => {
      let action = await this.actions
        .where({ userId })
        .filter(action => action.actionType === 'UpdateConfig')
        .first()
      if (!action) {
        action = {
          interestRate: data.interestRate,
          debtorInfo: data.debtorInfo,
          userId,
          actionType: 'UpdateConfig' as const,
          createdAt: new Date(),
        }
        await this.createActionRecord(action)
      }
      return action as UpdateConfigActionWithId
    })
  }

  async removeActionRecord(actionId: number): Promise<void> {
    await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
      const action = await this.actions.get(actionId)
      if (action) {
        const abortTransfer = async (transferUri: string): Promise<void> => {
          let transferRecord = await this.transfers.get(transferUri)
          if (transferRecord && transferRecord.userId === action.userId) {
            if (getTransferState(transferRecord) !== 'successful') {
              const initiationTime = getIsoTimeOrNow(transferRecord.initiatedAt)
              transferRecord.aborted = true
              await this.transfers.put(transferRecord)
              await this.tasks.put({
                userId: action.userId,
                taskType: 'DeleteTransfer',
                scheduledFor: new Date(initiationTime + 1000 * TRANSFER_DELETION_MIN_DELAY_SECONDS),
                transferUri,
              })
            }
          }
        }
        await this.actions.delete(actionId)
        if (action.actionType === 'AbortTransfer') {
          await abortTransfer(action.transferUri)
        }
      }
    })
  }

  /* Replaces, updates, or deletes the passed action record. Will
   * throw `RecordDoesNotExist` if the original action record does not
   * exist, or has been changed. Note that an `actionId` field will be
   * added to the passed `replacement` object if it does not have
   * one. */
  async replaceActionRecord(original: ActionRecordWithId, replacement: ActionRecord | null): Promise<void> {
    await this.transaction('rw', [this.transfers, this.actions, this.tasks], async () => {
      const { actionId, userId } = original
      const existing = await this.actions.get(actionId)
      if (!equal(existing, original)) {
        throw new RecordDoesNotExist()
      }
      assert(!replacement || replacement.userId === userId, 'wrong userId')
      assert(!replacement || replacement.actionId === undefined || replacement.actionId === actionId, 'wrong actionId')
      if (replacement && replacement.actionId === actionId) {
        // Update the action record "in place".
        assert(replacement.actionType === original.actionType, 'wrong actionType')
        await this.actions.put(replacement)
      } else {
        // Delete the original record.
        await this.removeActionRecord(actionId)

        // Put a replacement, if available.
        if (replacement) {
          await this.actions.add(replacement)
        }
      }
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

  /* Deletes the passed create transfer action record, and ensures
   * that a corresponding transfer record does exist.  Will throw
   * `RecordDoesNotExist` if the passed action record does not exist,
   * or has been changed. */
  async createTransferRecord(action: CreateTransferActionWithId, transfer: Transfer): Promise<TransferRecord> {
    return await this.transaction('rw', this.allTables, async () => {
      const { actionId, userId } = action

      // The validation of the action record must be done before the
      // call to `storeTransfer`, because the call will change the
      // action record.
      const existing = await this.actions.get(actionId)
      if (!equal(existing, action)) {
        throw new RecordDoesNotExist()
      }
      const transferRecord = await this.storeTransfer(userId, transfer)

      // The action record must be deleted after the `storeTransfer`
      // call, otherwise the `originatesHere` field in the transfer
      // record will not be set correctly.
      await this.actions.delete(actionId)

      return transferRecord
    })
  }

  async storeTransfer(userId: number, transfer: Transfer): Promise<TransferRecord> {
    const { uri: transferUri, transferUuid, initiatedAt, result } = transfer

    const getAbortTransferActionQuery = () => this.actions
      .where({ transferUri })
      .filter(
        action => action.actionType === 'AbortTransfer' && action.userId === userId
      ) as Collection<AbortTransferActionWithId, number>

    const matchCreateTransferAction = async (): Promise<boolean> => {
      const matched = await this.actions
        .where({ 'creationRequest.transferUuid': transferUuid })
        .filter(action => action.actionType === 'CreateTransfer')
        .modify((action: CreateTransferAction) => {
          action.execution = {
            startedAt: action.execution?.startedAt ?? new Date(),
            result: { ok: true, transferUri },
          }
        })
      return matched !== 0
    }

    const putTransferRecord = async (): Promise<TransferRecord> => {
      let transferRecord
      const existingTransferRecord = await this.transfers.get(transferUri)
      if (existingTransferRecord) {
        assert(existingTransferRecord.userId === userId, 'wrong userId')
        const { time, paymentInfo, originatesHere, aborted } = existingTransferRecord
        transferRecord = { ...transfer, userId, time, paymentInfo, originatesHere, aborted }
      } else {
        const time = getIsoTimeOrNow(initiatedAt)
        const paymentInfo = parseTransferNote(transfer)
        const originatesHere = await matchCreateTransferAction()
        transferRecord = { ...transfer, userId, time, paymentInfo, originatesHere, aborted: false }
      }
      let attemptsLeft = 100
      while (true) {
        try {
          await this.transfers.put(transferRecord)
          break
        } catch (e: unknown) {
          if (!(e instanceof Dexie.ConstraintError && attemptsLeft--)) throw e
          transferRecord.time *= (1 + Number.EPSILON)
        }
      }
      return transferRecord
    }

    const scheduleTransferDeletion = async (): Promise<void> => {
      const finalizationTime = getIsoTimeOrNow(result?.finalizedAt)
      await this.tasks.put({
        userId,
        taskType: 'DeleteTransfer',
        scheduledFor: new Date(finalizationTime + 1000 * TRANSFER_DELETION_DELAY_SECONDS),
        transferUri,
      })
    }

    const putAbortTransferAction = async (transfer: TransferRecord): Promise<void> => {
      let abortTransferAction: AbortTransferAction | undefined
      const existingAbortTransferAction = await getAbortTransferActionQuery().first()
      if (!existingAbortTransferAction) {
        abortTransferAction = {
          userId,
          actionType: 'AbortTransfer',
          createdAt: new Date(),
          transferUri,
          transfer,
        }
      } else if (!existingAbortTransferAction.transfer.result && transfer.result) {
        existingAbortTransferAction.transfer.result = transfer.result
        abortTransferAction = existingAbortTransferAction
      }
      if (abortTransferAction) {
        await this.actions.put(abortTransferAction)
      }
    }

    return await this.transaction('rw', this.allTables, async () => {
      if (!await this.isInstalledUser(userId)) {
        throw new UserDoesNotExist()
      }
      const transferRecord = await putTransferRecord()
      switch (getTransferState(transfer)) {
        case 'successful':
          await scheduleTransferDeletion()
          await getAbortTransferActionQuery().delete()
          break
        case 'delayed':
        case 'unsuccessful':
          if (!transferRecord.aborted) {
            await putAbortTransferAction(transferRecord)
          }
          break
      }
      return transferRecord
    })
  }

  async storeUserData(data: UserData): Promise<number> {
    const { collectedAfter, debtor, document, transferUris, transfers } = data

    const storeDebtorAndConfigRecords = async (): Promise<number> => {
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

    const deleteIrrelevantActionsAndTasks = async (userId: number): Promise<void> => {
      const uris = new Set(transferUris)
      await this.actions
        .where({ userId })
        .filter(action => action.actionType === 'AbortTransfer' && !uris.has(action.transferUri))
        .delete()
      await this.tasks
        .where({ userId })
        .filter(task => task.taskType === 'DeleteTransfer' && !uris.has(task.transferUri))
        .delete()
    }

    const resolveOldNotConfirmedCreateTransferRequests = async (userId: number): Promise<void> => {
      const currentTime = Date.now()
      const cutoffTime = collectedAfter.getTime() - MAX_PROCESSING_DELAY_MILLISECONDS
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

    const storeTransferRecords = async (userId: number): Promise<void> => {
      if (transfers) {
        for (const transfer of transfers) {
          if (!await this.isConcludedTransfer(transfer.uri)) {
            await this.storeTransfer(userId, transfer)
          }
        }
        resolveOldNotConfirmedCreateTransferRequests(userId)
      }
    }

    return await this.transaction('rw', this.allTables, async () => {
      const userId = await storeDebtorAndConfigRecords()
      await deleteIrrelevantActionsAndTasks(userId)
      await storeTransferRecords(userId)
      return userId
    })
  }

  async isConcludedTransfer(transferUri: string): Promise<boolean> {
    const transferRecord = await this.transfers.get(transferUri)
    return transferRecord !== undefined && (transferRecord.result !== undefined || transferRecord.aborted === true)
  }

  private async isInstalledUser(userId: number): Promise<boolean> {
    return await this.debtors.where({ userId }).count() === 1
  }

  private get allTables() {
    return [this.debtors, this.configs, this.transfers, this.documents, this.actions, this.tasks]
  }

}

function getIsoTimeOrNow(isoTime?: string): number {
  const time = isoTime ? new Date(isoTime).getTime() : NaN
  return Number.isFinite(time) ? time : Date.now()
}

export const db = new DebtorsDb()
