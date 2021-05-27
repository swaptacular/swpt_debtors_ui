import Dexie from 'dexie'
import type {
  ServerSession,
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

type UserId = {
  userId: number,
}

type UserRecord = {
  userId?: number,
  debtorUrl: string,
}

type DebtorRecord =
  & UserId
  & Omit<Debtor, 'config'>
  & { config: ObjectReference }

type DebtorConfigRecord =
  & UserId
  & DebtorConfig

type TransferRecord =
  & UserId
  & Transfer

type DocumentRecord =
  & UserId
  & ObjectReference
  & DocumentData

type ActionRecord =
  & UserId
  & ActionData

type UpdateConfigAction =
  & ActionRecord
  & { actionType: 'UpdateConfig' }
  & Omit<DebtorConfigUpdateRequest, 'configData'>
  & ConfigData

type CreateTransferAction =
  & ActionRecord
  & { actionType: 'CreateTransfer' }
  & TransferCreationRequest

type CancelTransferAction =
  & ActionRecord
  & { actionType: 'CancelTransfer' }
  & ObjectReference

type DeleteTransferAction =
  & ActionRecord
  & { actionType: 'DeleteTransfer' }
  & ObjectReference


export class LocalDb extends Dexie {
  users: Dexie.Table<UserRecord, number>
  debtors: Dexie.Table<DebtorRecord, string>
  configs: Dexie.Table<DebtorConfigRecord, string>
  transfers: Dexie.Table<TransferRecord, string>
  documents: Dexie.Table<DocumentRecord, string>
  actions: Dexie.Table<ActionRecord, number>

  constructor() {
    super('local-db')

    this.version(1).stores({
      users: '++userId,&debtorUrl',
      debtors: 'uri,&userId',
      configs: 'uri,&userId',
      transfers: 'uri,userId',
      documents: 'uri,userId',
      actions: '++actionId,userId',
    })

    this.users = this.table('users')
    this.debtors = this.table('debtors')
    this.configs = this.table('configs')
    this.transfers = this.table('transfers')
    this.documents = this.table('documents')
    this.actions = this.table('actions')
  }

  async getUser(debtorUrl: string): Promise<UserRecord | undefined> {
    return await this.users.where({ debtorUrl }).first()
  }

  async deleteUser(debtorUrl: string): Promise<void> {
    await this.transaction('rw', this.all_tables, async () => {
      const user = await this.getUser(debtorUrl)
      if (user) {
        const userId = user.userId
        for (const table of this.all_tables) {
          await table.where({ userId }).delete()
        }
      }
    })
  }

  async createUser(kw: {
    debtor: Debtor,
    transfers: Transfer[],
    actions: ActionData[],
    document?: ObjectReference & DocumentData,
  }): Promise<number> {
    const { debtor, transfers, actions, document } = kw
    const debtorUrl = debtor.uri

    return await this.transaction('rw', this.all_tables, async () => {
      await this.deleteUser(debtorUrl)
      const userId = await this.users.add({ debtorUrl })
      await this.debtors.add({ userId, ...debtor, config: { uri: debtor.config.uri } })
      await this.configs.add({ userId, ...debtor.config, uri: new URL(debtor.config.uri, debtorUrl).href })
      await this.transfers.bulkAdd(transfers.map(transfer => ({ userId, ...transfer })))
      await this.actions.bulkAdd(actions.map(action => ({ userId, ...action })))
      if (document) {
        await this.documents.add({ userId, ...document })
      }
      return userId
    })
  }

  async obtainUserId(session: ServerSession): Promise<number> {
    const debtorUrl = await session.getDebtorUrl()
    const userId = await this.transaction('rw', this.users, async () => {
      // If a user with the given `debtorUrl` exists, return its
      // primary key (the userId). Otherwise, add a new record and
      // return the auto-generated userId.
      const userIds = await this.users.where({ debtorUrl }).primaryKeys()
      switch (userIds.length) {
        case 0:
          return await this.users.add({ debtorUrl })
        case 1:
          return userIds[0]
        default:
          throw Error('database inconsistency')
      }
    })
    return userId
  }

  private get all_tables() {
    return [this.users, this.debtors, this.configs, this.transfers, this.documents, this.actions]
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
