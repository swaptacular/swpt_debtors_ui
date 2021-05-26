import Dexie from 'dexie'
import type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  DebtorConfigUpdateRequest,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


type User = {
  id?: number,
  debtorUrl: string,
}

type UserRecord = {
  userId: number,
}

type DebtorRecord = UserRecord & Omit<Debtor, 'config'> & {
  config: ObjectReference,
}

type DebtorConfigRecord = UserRecord & DebtorConfig

type TransferRecord = UserRecord & Transfer

type ActionRecord = UserRecord & {
  id?: number,
  addedAt: Date,
  actionType: string,
  error?: object,
}

// Will be serialized to something like this: '{
//   "type": "RootConfigData",
//   "rate": 10.0,
//   "info": {
//     "type": "DebtorInfo",
//     "iri": "https://example.com/debtors/1/",
//     "contentType": "text/html",
//     "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
//   }
// }'
type ConfigData = {
  rate: number,
  info: {
    iri: string | ArrayBuffer,
    contentType: string,
    sha256: string,
  }
}

type UpdateConfigAction =
  & Omit<DebtorConfigUpdateRequest, 'configData'>
  & ConfigData
  & ActionRecord
  & { actionType: 'UpdateConfig' }

type CreateTransferAction =
  & TransferCreationRequest
  & ActionRecord
  & { actionType: 'CreateTransfer' }

type CancelTransferAction =
  & ObjectReference
  & ActionRecord
  & { actionType: 'CancelTransfer' }

type DeleteTransferAction =
  & ObjectReference
  & ActionRecord
  & { actionType: 'DeleteTransfer' }


class LocalDb extends Dexie {
  users: Dexie.Table<User, number>
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<DebtorConfigRecord, number>
  transfers: Dexie.Table<TransferRecord, number>
  actions: Dexie.Table<ActionRecord, number>

  constructor() {
    super('local-db')

    this.version(1).stores({
      users: '++id,&debtorUrl',
      debtors: 'uri,&userId',
      configs: 'uri,&userId',
      transfers: 'uri,userId',
      actions: '++id,userId',
    })

    this.users = this.table('users')
    this.debtors = this.table('debtors')
    this.configs = this.table('configs')
    this.transfers = this.table('transfers')
    this.actions = this.table('actions')
  }
}

const db = new LocalDb();

export async function testPut() {
  return await db.users.put({ debtorUrl: 'xxxx' })
}
