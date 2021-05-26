import Dexie from 'dexie'
import type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  DebtorConfigUpdateRequest,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


type ConfigData = {
  rate: number,
  info: {
    iri: string | ArrayBuffer,
    contentType: string,
    sha256: string,
  }
}

type DocumentContent = {
  contentType: string,
  content: ArrayBuffer,
}

type ActionData = {
  actionId?: number,
  actionType: string,
  initiatedAt: Date,
  error?: object,
}

type UserRef = {
  userId: number,
}

type UserRecord = {
  userId?: number,
  debtorUrl: string,
}

type DebtorRecord =
  & UserRef
  & Omit<Debtor, 'config'>
  & { config: ObjectReference }

type DebtorConfigRecord =
  & UserRef
  & DebtorConfig

type TransferRecord =
  & UserRef
  & Transfer

type DocumentRecord =
  & UserRef
  & ObjectReference
  & DocumentContent

type ActionRecord =
  & UserRef
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


class LocalDb extends Dexie {
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
}

const db = new LocalDb();

export async function testPut() {
  return await db.users.put({ debtorUrl: 'xxxx' })
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
