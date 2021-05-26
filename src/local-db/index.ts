import Dexie from 'dexie'
import type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


type UserRecord = {
  id?: number,
  debtorUrl: string,
}

type DebtorRecord = Omit<Debtor, 'config'> & {
  userId: number,
  config: ObjectReference,
}

type DebtorConfigRecord = DebtorConfig & {
  userId: number,
}

type TransferRecord = Transfer & {
  userId: number,
}

type PendingAction = {
  id?: number,
  userId: number,
  addedAt: Date,
  actionType: string,
  error?: object,
}

type UpdateConfigAction = PendingAction & {
  // configData = '{
  //   "type": "RootConfigData",
  //   "rate": 10.0,
  //   "info": {
  //     "type": "DebtorInfo",
  //     "iri": "https://example.com/debtors/1/",
  //     "contentType": "text/html",
  //     "sha256": "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
  //   }
  // }'

  actionType: 'UpdateConfig',
  latestUpdateId: bigint,
  rate: number,
  info: {
    iri: string | ArrayBuffer,
    contentType: string,
    sha256: string,
  }
}

type CreateTransferAction = PendingAction & Omit<TransferCreationRequest, "type"> & {
  actionType: 'CreateTransfer',
}

type CancelTransferAction = PendingAction & {
  actionType: 'CancelTransfer',
  uri: string,
}

type DeleteTransferAction = PendingAction & {
  actionType: 'DeleteTransfer',
  uri: string,
}


class LocalDb extends Dexie {
  users: Dexie.Table<UserRecord, number>
  debtors: Dexie.Table<DebtorRecord, number>
  configs: Dexie.Table<DebtorConfigRecord, number>
  transfers: Dexie.Table<TransferRecord, number>
  actions: Dexie.Table<PendingAction, number>

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
