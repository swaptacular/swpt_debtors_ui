import Dexie from 'dexie'
import type {
  Debtor,
  Transfer,
  TransferCreationRequest,
} from '../server-api'


type UserRecord = {
  id?: number,
  debtorUrl: string,
  lastUse?: Date,
}

type DebtorRecord = Debtor & {
  userId: number,
}

type TransferRecord = Transfer & {
  userId: number,
}

type ActionRecord = {
  type: 'update-config' | 'new-transfer' | 'delete-transfer' | 'cancel-transfer',
  status: 'pending' | 'successful' | 'failed'
  createdAt: Date,
}

type DebtorConfigUpdateAction = ActionRecord & {
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

  type: 'update-config',
  latestUpdateId: bigint,
  rate: number,
  info: {
    iri: string | ArrayBuffer,
    contentType: string,
    sha256: string,
  }
}

type CreateTransferAction = ActionRecord & Omit<TransferCreationRequest, "type"> & {
  type: 'create-transfer',
}

type CancelTransferAction = ActionRecord & {
  type: 'cancel-transfer',
}

type DeleteTransferAction = ActionRecord & {
  type: 'delete-transfer',
}


class LocalDb extends Dexie {
  users: Dexie.Table<UserRecord, number>
  debtors: Dexie.Table<DebtorRecord, number>
  transfers: Dexie.Table<TransferRecord, number>
  actions: Dexie.Table<ActionRecord, number>

  constructor() {
    super('local-db')

    this.version(1).stores({
      users: '++id,debtorUrl',
      debtors: 'userId',
      transfers: '',
      actions: '',
    })

    this.users = this.table('users')
    this.debtors = this.table('debtors')
    this.transfers = this.table('transfers')
    this.actions = this.table('actions')
  }
}

const db = new LocalDb();

export async function testPut() {
  return await db.users.put({ debtorUrl: 'xxxx' })
}
