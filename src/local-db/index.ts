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

  async installUser({ debtor, transfers, document }: UserInstallationData): Promise<number> {
    return await this.transaction('rw', this.allTables, async () => {
      const debtorRecord = await this.getDebtorRecord(debtor.uri)
      if (debtorRecord) {
        throw new UserAlreadyInstalled(`userId=${debtorRecord.userId}`)
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

  async getDebtorRecord(userId: number): Promise<DebtorRecord | undefined>
  async getDebtorRecord(debtorUri: string): Promise<DebtorRecord | undefined>
  async getDebtorRecord(key: number | string): Promise<DebtorRecord | undefined> {
    if (typeof key === 'number') {
      return await this.debtors.get(key)
    }
    return await this.debtors.where({ uri: key }).first()
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
