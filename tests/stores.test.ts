import { liveQuery } from 'dexie'
import { createStore } from '../src/stores'
import { db } from '../src/operations/db'

test("Create store from live query", async () => {
  let value
  const store = await createStore(liveQuery(() => db.debtors.toArray()))
  const unsubscribe = store.subscribe((v) => { value = v })
  const debtor = { "userId": 1, "uri": "https://example.com/debtors/1/" } as any
  expect(value).toEqual([])
  await db.debtors.put(debtor)
  await new Promise((r) => setTimeout(r, 200))
  expect(value).toEqual([debtor])
  unsubscribe()
})
