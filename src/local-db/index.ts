import Dexie from 'dexie'

type User = {
  id?: number,
  debtorUrl: string,
  lastUse?: Date,
}

class LocalDb extends Dexie {
  users: Dexie.Table<User, number>

  constructor() {
    super('local-db')

    this.version(1).stores({
      users: '++id,debtorUrl',
    })

    this.users = this.table('users')
  }
}

const db = new LocalDb();

export async function testPut() {
  return await db.users.put({ debtorUrl: 'xxxx' })
}
