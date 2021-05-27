import App from '../src/App.svelte'
import { stringify, parse } from '../src/json-bigint/index.js'
import { ServerSession, HttpError, AuthTokenSource } from '../src/server-api/index.js'
import { LocalDb, DebtorRecord } from '../src/local-db/index.js'

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
  const db = new LocalDb();
  const userId = await db.installUser({ debtor, transfers: [], actions: [] })
  const debtorRecord = await db.getDebtorRecord(userId) as DebtorRecord
  expect(typeof debtorRecord).toBe('object')
  expect(typeof debtorRecord?.userId).toBe('number')
  expect(debtorRecord.config.uri).toBe('config')
  expect(debtorRecord.config).toEqual({ uri: 'config' })

  await db.uninstallUser(userId)
  expect(await db.getDebtorRecord(userId)).toBeUndefined
})
