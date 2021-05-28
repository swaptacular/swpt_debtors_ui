import Dexie from 'dexie'
import type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  DebtorConfigUpdateRequest,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


type DocumentUri = string

type DocumentData = {
  content: ArrayBuffer,
  contentType: string,
}

type ConfigData = {
  rate: number,
  info: DocumentUri | DocumentData,
}

type ActionData = {
  actionId?: number,
  actionType: string,
  initiatedAt: Date,
  error?: object,
}

export type UserInstallationData = {
  debtor: Debtor,
  transfers: Transfer[],
  document?: ObjectReference & DocumentData,
}

export type UserReference = {
  userId: number,
}

export type DebtorRecord =
  & Partial<UserReference>
  & Omit<Debtor, 'config'>
  & { config: ObjectReference }

export type DebtorConfigRecord =
  & UserReference
  & DebtorConfig

export type TransferRecord =
  & UserReference
  & Transfer

export type DocumentRecord =
  & UserReference
  & ObjectReference
  & DocumentData

export type ActionRecord =
  & UserReference
  & ActionData

export type UpdateConfigActionRecord =
  & ActionRecord
  & { actionType: 'UpdateConfig' }
  & Omit<DebtorConfigUpdateRequest, 'configData'>
  & ConfigData

export type CreateTransferActionRecord =
  & ActionRecord
  & { actionType: 'CreateTransfer' }
  & TransferCreationRequest

export type CancelTransferActionRecord =
  & ActionRecord
  & { actionType: 'CancelTransfer' }
  & ObjectReference

export type DeleteTransferActionRecord =
  & ActionRecord
  & { actionType: 'DeleteTransfer' }
  & ObjectReference


export class UserAlreadyInstalled extends Error {
  name = 'UserAlreadyInstalled'
}


export class UserDoesNotExist extends Error {
  name = 'UserDoesNotExist'
}


export class LocalDb extends Dexie {
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<DebtorConfigRecord, string>
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

  async isUserInstalled(userId: number): Promise<boolean>
  async isUserInstalled(uri: string): Promise<boolean>
  async isUserInstalled(keyValue: number | string): Promise<boolean> {
    const keyName = typeof keyValue === 'number' ? 'userId' : 'uri'
    return await this.debtors.where(keyName).equals(keyValue).count() === 1
  }

  // Note that the `uri` property in `debtor` and `transfers` objects
  // must contain absolute URIs. The server may return relative URIs
  // in the responses, which must be transformed to absolute ones,
  // before passed to this method.
  async installUser({ debtor, transfers, document }: UserInstallationData): Promise<number> {
    return await this.transaction('rw', this.allTables, async () => {
      if (await this.isUserInstalled(debtor.uri)) {
        throw new UserAlreadyInstalled(debtor.uri)
      }
      const userId = await this.debtors.add({ ...debtor, config: { uri: debtor.config.uri } })
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

  async getUserId(debtorUri: string): Promise<number | undefined> {
    return (await this.debtors.where({ uri: debtorUri }).primaryKeys())[0]
  }

  async getDebtorRecord(userId: number): Promise<DebtorRecord> {
    const debtorRecord = await this.debtors.get(userId)
    if (!debtorRecord) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return debtorRecord
  }

  async getDebtorConfigRecord(userId: number): Promise<DebtorConfigRecord> {
    const debtorConfigRecord = await this.configs.where({ userId }).first()
    if (!debtorConfigRecord) {
      throw new UserDoesNotExist(`userId=${userId}`)
    }
    return debtorConfigRecord
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

  async getDocument(uri: string): Promise<DocumentRecord | undefined> {
    return await this.documents.get({ uri })
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
