import App from '../src/App.svelte'
import { stringify, parse } from '../src/json-bigint/index.js'
import { ServerSession, HttpError, AuthTokenSource } from '../src/server-api/index.js'
import {
  LocalDb,
  DebtorRecord,
  UserDoesNotExist,
  UserAlreadyInstalled,
  AlreadyResolvedAction,
} from '../src/local-db/index.js'

const authToken = '3x-KAxNWrYPJUWNKTbpnTWxoR0Arr0gG_uEqeWUNDkk.B-Iqy02FM7rK1rKSb4I7D9gaqGFXc2vdyJQ6Uuv3EF4'

class SingleToken implements AuthTokenSource {
  token?: string

  constructor(token: string) {
    this.token = token
  }

  getToken() {
    if (this.token === undefined) {
      throw Error('Can not obtain token.')
    }
    return Promise.resolve(this.token)
  }

  invalidateToken(token: string) {
    if (token === this.token) {
      this.token = undefined
    }
  }
}


test("Instantiate svelte app", () => {
  const el = document.body
  const app = new App({
    target: el,
    props: { name: 'world' },
  })
  expect(el).toBeInstanceOf(HTMLElement)
  expect(app).toBeTruthy()
})

test("Stringify non-ASCII", () => {
  const s = stringify("Кирилица")
  expect(s).toBe('"Кирилица"')
})

test("Stringify bigint", () => {
  const s = stringify({ float: 1, int: 1n, bigint: 123456789012345678901234567890n })
  expect(s).toBe('{\"float":1,"int":1,"bigint":123456789012345678901234567890}')
})

test("Parse bigint", () => {
  const o = parse('{\"float":1.0,"int":1,"bigint":123456789012345678901234567890}')
  expect(o).toEqual({ float: 1, int: 1n, bigint: 123456789012345678901234567890n })
})

test("Create ServerSession", async () => {
  const session = new ServerSession(new SingleToken(authToken))
  expect(session).toBeInstanceOf(ServerSession)
})

test.skip("Get debtor URL", async () => {
  const session = new ServerSession(new SingleToken(authToken))
  const debtorUrl = await session.getDebtorUrl()
  expect(debtorUrl).toContain('/debtors/')
})

test.skip("Request debtor info", async () => {
  const session = new ServerSession(new SingleToken(authToken))
  const debtorUrl = await session.getDebtorUrl()
  const response = await session.get(debtorUrl)
  expect(response.status).toBe(200)
  expect(response.data).toHaveProperty('identity')
})

test.skip("Try to cancel non-existing transfer", async () => {
  const session = new ServerSession(new SingleToken(authToken))
  const debtorUrl = await session.getDebtorUrl()
  try {
    await session.post(`${debtorUrl}transfers/123e4567-e89b-12d3-a456-426655440000`)
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError)
    expect(e.status).toBe(404)
    expect(e.url).toContain('123e4567-e89b-12d3-a456-426655440000')
  }
})

test.skip("Try to save document", async () => {
  const session = new ServerSession(new SingleToken(authToken))
  const debtorUrl = await session.getDebtorUrl()
  const buffer = new ArrayBuffer(4)
  const view = new Int32Array(buffer);
  view[0] = 0
  const response = await session.postDocument(`${debtorUrl}documents/`, 'application/octet-stream', buffer)
  expect(response.url.length > 0).toBeTruthy()
  expect(response.headers['content-type']).toBe('application/octet-stream')
  expect(typeof response.data).toBe('object')  // ArrayBuffer or Buffer
})

test("Install and uninstall user", async () => {
  const debtor = {
    type: 'Debtor',
    uri: 'https://example.com/1/',
    createTransfer: { uri: 'https://example.com/1/transfers/' },
    saveDocument: { uri: 'https://example.com/1/documents/' },
    publicInfoDocument: { uri: 'https:/example.com/1/public' },
    transfersList: { uri: 'https://example.com/1/transfers/' },
    noteMaxBytes: 200n,
    identity: { type: 'DebtorIdentity', uri: 'swpt:1234' },
    balance: 20000n,
    createdAt: '2020-01-01T00:00:00Z',
    config: {
      uri: 'config',
      latestUpdateAt: '2020-01-01T00:00:00Z',
      latestUpdateId: 1n,
      configData: '',
      debtor: { uri: 'https://example.com/1/' }
    },
  }
  const transfers = [{
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/xxxxxxxxx',
    recipient: { uri: 'swpt:1/2' },
    amount: 1000n,
    transferUuid: 'xxxxxxxxx',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: '2020-01-01T00:00:00Z',
  }]
  const document = {
    uri: 'https://example.com/1/documents/123',
    contentType: 'text/plain',
    content: new ArrayBuffer(4),
  }
  const db = new LocalDb();
  const userId = await db.installUser({ debtor, transfers, document })
  const debtorRecord = await db.getDebtorRecord(userId) as DebtorRecord
  expect(debtorRecord.userId).toEqual(userId)
  expect(debtorRecord.config.uri).toBe('config')
  expect(debtorRecord.config).toEqual({ uri: 'config' })
  await expect(db.getUserId(debtor.uri)).resolves.toBeDefined()
  await expect(db.isUserInstalled(userId)).resolves.toBeTruthy()
  await expect(db.getConfigRecord(userId)).resolves.toEqual({
    ...debtor.config,
    uri: 'https://example.com/1/config',
    userId,
  })
  await expect(db.getTransferRecords(userId)).resolves.toEqual(transfers.map(t => ({ ...t, userId })))
  await expect(db.getDocument('https://example.com/1/documents/123')).resolves.toEqual({ ...document, userId })
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  await expect(db.installUser({ debtor, transfers: [] })).rejects.toBeInstanceOf(UserAlreadyInstalled)

  const actionRecord = {
    userId,
    actionType: 'DeleteTransfer',
    initiatedAt: new Date(),
    uri: 'https://example.com/1/transfers/xxxxxxxx',
  } as const
  await expect(db.getActionRecord(456)).resolves.toBeUndefined()
  let actionId = await db.addActionRecord(actionRecord)
  expect(actionId).toBeDefined()
  await expect(db.getActionRecord(actionId)).resolves.toBeDefined()
  await db.resolveAction(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeUndefined()
  await expect(db.resolveAction(actionId)).rejects.toBeInstanceOf(AlreadyResolvedAction)

  actionId = await db.addActionRecord(actionRecord)
  await db.resolveAction(actionId, { errorCode: 666 })
  await expect(db.getActionRecord(actionId)).resolves.toEqual({ ...actionRecord, actionId, error: { errorCode: 666 } })
  await expect(db.resolveAction(actionId)).rejects.toBeInstanceOf(AlreadyResolvedAction)
  await expect(db.resolveAction(actionId, { errorCode: 666 })).rejects.toBeInstanceOf(AlreadyResolvedAction)
  await expect(db.resolveAction(actionId, { errorCode: 777 })).rejects.toBeInstanceOf(AlreadyResolvedAction)

  await db.uninstallUser(userId)
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()
  await expect(db.isUserInstalled(userId)).resolves.toBeFalsy()
  await expect(db.getDebtorRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getConfigRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getTransferRecords(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getActionRecords(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getDocument('https://example.com/1/documents/123')).resolves.toEqual(undefined)
})
