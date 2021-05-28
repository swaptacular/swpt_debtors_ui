import Dexie from 'dexie'
import type {
  ObjectReference as ResourceReference,
  Debtor,
  DebtorConfig,
  DebtorConfigUpdateRequest,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


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

export type DocumentRecord =
  & UserReference
  & Document

export type ActionRecord =
  | UpdateConfigAction
  | CreateTransferAction
  | CancelTransferAction
  | DeleteTransferAction

export type UpdateConfigAction =
  & ActionData
  & { actionType: 'UpdateConfig' }
  & Omit<DebtorConfigUpdateRequest, 'configData'>
  & ConfigData

export type CreateTransferAction =
  & ActionData
  & { actionType: 'CreateTransfer' }
  & TransferCreationRequest

export type CancelTransferAction =
  & ActionData
  & { actionType: 'CancelTransfer' }
  & ResourceReference

export type DeleteTransferAction =
  & ActionData
  & { actionType: 'DeleteTransfer' }
  & ResourceReference


export class UserAlreadyInstalled extends Error {
  name = 'UserAlreadyInstalled'
}


export class UserDoesNotExist extends Error {
  name = 'UserDoesNotExist'
}


export class AlreadyResolvedAction extends Error {
  name = 'AlreadyResolvedAction'
}


export class LocalDb extends Dexie {
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<ConfigRecord, string>
  transfers: Dexie.Table<TransferRecord, string>
  documents: Dexie.Table<DocumentRecord, string>
  actions: Dexie.Table<ActionRecord, number>

  constructor() {
    super('local-db')

    this.version(1).stores({
      debtors: '++userId,&uri',
      configs: 'uri,&userId',
      transfers: 'uri,userId',
      documents: 'uri,userId',
      actions: '++actionId,userId',
    })

    this.debtors = this.table('debtors')
    this.configs = this.table('configs')
    this.transfers = this.table('transfers')
    this.documents = this.table('documents')
    this.actions = this.table('actions')
  }

  async getUserId(debtorUri: string): Promise<number | undefined> {
    return (await this.debtors.where({ uri: debtorUri }).primaryKeys())[0]
  }

  // Note that the `uri` property in `debtor` and `transfers` objects
  // must contain absolute URIs. The server may return relative URIs
  // in the responses, which must be transformed to absolute ones,
  // before passed to this method.
  async installUser({ debtor, transfers, document }: UserInstallationData): Promise<number> {
    return await this.transaction('rw', this.allTables, async () => {
      const existingUserId = await this.getUserId(debtor.uri)
      if (existingUserId) {
        throw new UserAlreadyInstalled(`userId=${existingUserId}`)
      }
      const userId = await this.debtors.add({ ...debtor, userId: undefined, config: { uri: debtor.config.uri } })
      await this.configs.add({ userId, ...debtor.config, uri: new URL(debtor.config.uri, debtor.uri).href })
      await this.transfers.bulkAdd(transfers.map(transfer => ({ userId, ...transfer })))
      if (document) {
        await this.documents.add({ userId, ...document })
      }
      return userId
    })
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

  async initiateAction(action: ActionRecord): Promise<number> {
    if (action.actionId !== undefined) {
      throw new Error('wrong actionId value')
    }
    const actionId = await this.actions.add({ ...action })
    return actionId
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
        await this.actions.update(actionId, { error })
      }
    })
  }

  async replaceAction(action: ActionRecord): Promise<void> {
    // TODO:
  }

  async getDocument(uri: string): Promise<DocumentRecord | undefined> {
    return await this.documents.get(uri)
  }

  private get allTables() {
    return [this.debtors, this.configs, this.transfers, this.documents, this.actions]
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
