import Dexie from 'dexie'
import type {
  ObjectReference as ResourceReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
} from '../web-api-schemas'


type ListQueryOptions = {
  before?: number,
  after?: number,
  limit?: number,
  latestFirst?: boolean,
}

type UserReference = {
  userId: number,
}

type DocumentData = {
  content: ArrayBuffer,
  contentType: string,
}

type Document =
  & ResourceReference
  & DocumentData

type DocumentUri = string

type ConfigData = {
  rate: number,
  info: DocumentUri | DocumentData,
}

type ActionData =
  & UserReference
  & {
    actionId?: number,
    actionType: string,
    createdAt: Date,
    error?: object,
  }

export type UserInstallationData = {
  debtor: Debtor,
  transfers: Transfer[],
  document?: ResourceReference & DocumentData,
}

export type DebtorRecord =
  & Partial<UserReference>
  & Omit<Debtor, 'config'>
  & { config: ResourceReference }

export type DebtorRecordWithId =
  & DebtorRecord
  & { userId: number }

export type ConfigRecord =
  & UserReference
  & DebtorConfig

export type TransferRecord =
  & UserReference
  & Transfer
  & { time: number, aborted?: true }

export type DocumentRecord =
  & UserReference
  & Document

export type ActionRecord =
  | UpdateConfigAction
  | CreateTransferAction
  | AbortTransferAction

export type ActionRecordWithId =
  & ActionRecord
  & { actionId: number }

export type UpdateConfigAction =
  & ActionData
  & { actionType: 'UpdateConfig' }
  & ConfigData

export type CreateTransferAction =
  & ActionData
  & { actionType: 'CreateTransfer' }
  & TransferCreationRequest

export type AbortTransferAction =
  & ActionData
  & { actionType: 'AbortTransfer' }
  & ResourceReference

export type ScheduledDeletionRecord =
  & UserReference
  & { resourceType: 'Transfer' }
  & ResourceReference

export class RecordDoesNotExist extends Error {
  name = 'RecordDoesNotExist'
}

export const TRANSFER_WAIT_SECONDS = 86400  // 24 hours

export function getTransferState(transfer: Transfer): 'waiting' | 'delayed' | 'successful' | 'unsuccessful' {
  const result = transfer.result
  if (result === undefined) {
    const initiatedAt = new Date(transfer.initiatedAt)
    const deadline = new Date(initiatedAt.getTime() + 1000 * TRANSFER_WAIT_SECONDS)
    const now = new Date()
    return now <= deadline ? 'waiting' : 'delayed'

  } else if (result.error) {
    return 'unsuccessful'

  } else {
    return 'successful'
  }
}

export class DebtorsDb extends Dexie {
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<ConfigRecord, string>
  transfers: Dexie.Table<TransferRecord, string>
  documents: Dexie.Table<DocumentRecord, string>
  actions: Dexie.Table<ActionRecord, number>
  scheduledDeletions: Dexie.Table<ScheduledDeletionRecord, string>

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
      actions: '++actionId,&[userId+actionId]',
      scheduledDeletions: 'uri,userId',
    })

    this.debtors = this.table('debtors')
    this.configs = this.table('configs')
    this.transfers = this.table('transfers')
    this.documents = this.table('documents')
    this.actions = this.table('actions')
    this.scheduledDeletions = this.table('scheduledDeletions')
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
      this.actions.delete(actionId)
      const userId = actionRecord.userId

      let configRecord = await this.configs.get(debtorConfig.uri)
      if (!(
        configRecord &&
        configRecord.userId === userId &&
        configRecord.latestUpdateId >= debtorConfig.latestUpdateId
      )) {
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

  async createTransfer(actionId: number, transfer: Transfer): Promise<TransferRecord> {
    return await this.transaction('rw', [this.transfers, this.actions], async () => {
      const actionRecord = await this.actions.get(actionId)
      if (!(actionRecord && actionRecord.actionType === 'CreateTransfer')) {
        throw new RecordDoesNotExist(`ActionRecord(actionId=${actionId}, actionType="CreateTransfer")`)
      }
      this.actions.delete(actionId)
      const userId = actionRecord.userId
      const alreadyExists = await this.putTransferRecord(transfer, userId)
      if (alreadyExists) {
        console.warn(
          `Instead of creating a new transfer record, an existing record has ` +
          `been overwritten (uri=${transfer.uri}). Possible UUID duplication.`
        )
      }
      return await this.transfers.get(transfer.uri) as TransferRecord
    })
  }

  async abortTransfer(actionId: number): Promise<void> {
    return await this.transaction('rw', [this.transfers, this.actions], async () => {
      const actionRecord = await this.actions.get(actionId)
      if (!(actionRecord && actionRecord.actionType === 'AbortTransfer')) {
        throw new RecordDoesNotExist(`ActionRecord(actionId=${actionId}, actionType="AbortTransfer")`)
      }
      this.actions.delete(actionId)

      const { uri, userId } = actionRecord
      this.transfers
        .where({ uri })
        .filter(record => record.userId === userId)
        .modify({ aborted: true })
    })
  }

  async isConcludedTransfer(uri: string): Promise<boolean> {
    const transferRecord = await this.transfers.get(uri)
    return transferRecord?.result !== undefined || transferRecord?.aborted === true
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

  async createActionRecord(action: ActionRecord & { actionId?: undefined }): Promise<number> {
    return await this.transaction('rw', [this.debtors, this.actions], async () => {
      const userId = action.userId
      if (!await this.isInstalledUser(userId)) {
        throw new RecordDoesNotExist(`DebtorRecord(userId=${userId})`)
      }
      return await this.actions.add(action)  // Returns the new actionId.
    })
  }

  async replaceActionRecord(actionId: number, action: ActionRecord & { actionId?: undefined }): Promise<number> {
    return await this.transaction('rw', this.actions, async () => {
      const found = await this.actions.where({ actionId }).delete() == 1
      if (!found) {
        throw new RecordDoesNotExist(`ActionRecord(actionId=${actionId})`)
      }
      return await this.actions.add(action)  // Returns the new actionId.
    })
  }

  async deleteActionRecord(actionId: number): Promise<void> {
    await this.actions.delete(actionId)
  }

  async getDocumentRecord(uri: string): Promise<DocumentRecord | undefined> {
    return await this.documents.get(uri)
  }

  async storeUserData({ debtor, document, transfers }: UserInstallationData): Promise<number> {
    // Note that the `uri` property in `debtor` and `transfers` objects
    // must contain absolute URIs. The server may return relative URIs
    // in the responses, which must be transformed to absolute ones,
    // before passed to this method.

    return await this.transaction('rw', this.allTables, async () => {
      const config = debtor.config
      let userId = await this.getUserId(debtor.uri)
      userId = await this.debtors.put({ ...debtor, userId, config: { uri: config.uri } })

      const configRecord = await this.configs.where({ userId }).first()
      if (!(configRecord && configRecord.latestUpdateId >= config.latestUpdateId)) {
        const uri = new URL(config.uri, debtor.uri).href
        await this.configs.put({ ...config, userId, uri })
        if (document) {
          await this.documents.put({ ...document, userId })
        }
      }

      for (const transfer of transfers) {
        const uri = transfer.uri
        if (!await this.isConcludedTransfer(uri)) {
          switch (getTransferState(transfer)) {
            case 'unsuccessful':
            case 'delayed':
              await this.putTransferRecord(transfer, userId)
              const existingAbortTransferAction = await this.actions
                .where({ userId })
                .filter(action => action.actionType === 'AbortTransfer' && action.uri === uri)
                .first()
              if (!existingAbortTransferAction)
                await this.actions.add({
                  userId,
                  actionType: 'AbortTransfer',
                  uri,
                  createdAt: new Date(),
                })
              break
            case 'successful':
              await this.transfers.update(uri, transfer)
              await this.scheduledDeletions.put({ uri, userId, resourceType: 'Transfer' })
              break
          }
        }
      }
      return userId
    })
  }

  private async putTransferRecord(transfer: Transfer, userId: number): Promise<boolean> {
    return await this.transaction('rw', this.transfers, async () => {
      const existingTransferRecord = await this.transfers.get(transfer.uri)

      // When the transfer record already exists, make sure `userId`
      // and `time` stay the same.
      if (existingTransferRecord) {
        if (userId !== existingTransferRecord.userId) {
          throw new Error('Can not alter the userId of an existing transfer record.')
        }
        const time = existingTransferRecord.time
        await this.transfers.put({ ...transfer, userId, time })
        return true
      }

      // When the transfer record does not exist, obtain the `time`
      // from the transfer's `initiatedAt` field, and if it is not
      // unique, increment it with epsilon.
      let time = new Date(transfer.initiatedAt).getTime() || Date.now()
      while (true) {
        try {
          await this.transfers.put({ ...transfer, userId, time })
          return false
        } catch (e: unknown) {
          if (!(e instanceof Dexie.ConstraintError)) throw e
          time *= (1 + Number.EPSILON)
        }
      }
    })
  }

  private async isInstalledUser(userId: number): Promise<boolean> {
    return await this.debtors.where({ userId }).count() === 1
  }

  private get allTables() {
    return [this.debtors, this.configs, this.transfers, this.documents, this.actions, this.scheduledDeletions]
  }
}
