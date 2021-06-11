import Dexie from 'dexie'
import type {
  ObjectReference as ResourceReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
} from './web-api-schemas'


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
    initiatedAt: Date,
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

export type ConfigRecord =
  & UserReference
  & DebtorConfig

export type TransferRecord =
  & UserReference
  & Transfer
  & { aborted?: true }

export type DocumentRecord =
  & UserReference
  & Document

export type ActionRecord =
  | UpdateConfigAction
  | CreateTransferAction
  | AbortTransferAction

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


export class UserAlreadyInstalled extends Error {
  name = 'UserAlreadyInstalled'
  userId: number

  constructor(userId: number) {
    super(`userId=${userId}`)
    this.userId = userId
  }
}


export class UserDoesNotExist extends Error {
  name = 'UserDoesNotExist'
}


export class AlreadyResolvedAction extends Error {
  name = 'AlreadyResolvedAction'
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


export class LocalDb extends Dexie {
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
      transfers: 'uri,userId,initiatedAt',
      documents: 'uri,userId',
      actions: '++actionId,userId',
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

  async isUserInstalled(userId: number): Promise<boolean> {
    return await this.debtors.where({ userId }).count() === 1
  }

  async getDebtorRecord(userId: number): Promise<DebtorRecord> {
    const debtorRecord = await this.debtors.get(userId)
    if (!debtorRecord) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return debtorRecord
  }

  async getConfigRecord(userId: number): Promise<ConfigRecord> {
    const configRecord = await this.configs.where({ userId }).first()
    if (!configRecord) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return configRecord
  }

  async getTransferRecords(userId: number): Promise<TransferRecord[]> {
    const transferRecords = await this.transfers.where({ userId }).toArray()
    if (transferRecords.length === 0 && !await this.isUserInstalled(userId)) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return transferRecords
  }

  async getTransferRecord(uri: string): Promise<TransferRecord | undefined> {
    return await this.transfers.get(uri)
  }

  async isConcludedTransfer(uri: string): Promise<boolean> {
    const transferRecord = await this.transfers.get(uri)
    return transferRecord?.result !== undefined || transferRecord?.aborted === true
  }

  async getActionRecords(userId: number): Promise<ActionRecord[]> {
    const actionRecords = await this.actions.where({ userId }).toArray()
    if (actionRecords.length === 0 && !await this.isUserInstalled(userId)) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return actionRecords
  }

  async getActionRecord(actionId: number): Promise<ActionRecord | undefined> {
    return await this.actions.get(actionId)
  }

  async createAction(action: ActionRecord): Promise<number> {
    if (action.actionId !== undefined) {
      throw new Error('wrong actionId value')
    }
    const actionId = await this.actions.add(action)
    return actionId
  }

  async deleteAction(actionId: number): Promise<void> {
    await this.actions.delete(actionId)
  }

  async updateAction(action: ActionRecord): Promise<void> {
    if (action.actionId === undefined) {
      throw new Error('undefined actionId')
    }
    await this.actions.put(action)
  }

  // When the action has been successful, its action record gets
  // removed. Otherwise, the reason for the failure is written to
  // the `error` property of the action record.
  async resolveAction(actionId: number, error?: object): Promise<void> {
    return await this.transaction('rw', this.actions, async () => {
      const actionRecord = await this.actions.get(actionId)
      if (!actionRecord || actionRecord.error) {
        throw new AlreadyResolvedAction(`actionId=${actionId}`)
      }
      if (!error) {
        await this.actions.delete(actionId)
      } else {
        await this.actions.update(actionId, { ...actionRecord, error })
      }
    })
  }

  async getDocument(uri: string): Promise<DocumentRecord | undefined> {
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
        await this.documents.where({ userId }).delete()
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
              await this.transfers.put({ ...transfer, userId })
              const existingAbortTransferAction = await this.actions
                .where({ userId })
                .filter(action => action.actionType === 'AbortTransfer' && action.uri === uri)
                .first()
              if (!existingAbortTransferAction)
                await this.actions.add({
                  userId,
                  actionType: 'AbortTransfer',
                  uri,
                  initiatedAt: new Date(),
                })
              break
            case 'successful':
              await this.transfers.update(uri, { ...transfer, userId })
              await this.scheduledDeletions.put({ uri, userId, resourceType: 'Transfer' })
              break
          }
        }
      }
      return userId
    })
  }

  private get allTables() {
    return [this.debtors, this.configs, this.transfers, this.documents, this.actions, this.scheduledDeletions]
  }
}

// The `ConfigData` will be serialized to something like this: '{
//   "type": "RootConfigData",
//   "rate": 10.0,
//   "info": {
//     "type": "DebtorInfo",
//     "iri": "https://example.com/debtors/1/",
//     "contentType": "text/html",
//     "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
//   }
// }'
