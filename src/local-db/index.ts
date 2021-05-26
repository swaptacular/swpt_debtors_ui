import Dexie from 'dexie'

var db = new Dexie('local-db');
db.version(1).stores({
  debtors: '++id,debtorUrl'
});

export async function testPut() {
  return await db.debtors.put({ debtorUrl: 'xxxx' })
}
