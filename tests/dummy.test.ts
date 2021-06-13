import App from '../src/App.svelte'
import { stringify, parse } from '../src/web-api/json-bigint'
import type { AuthTokenSource } from '../src/web-api/oauth2-token-source'
import { ServerSession, HttpError } from '../src/web-api'
import { DebtorsDb, DebtorRecord, RecordDoesNotExist } from '../src/operations/db'

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

  logout() { }
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

test.skip("Create ServerSession", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  expect(session).toBeInstanceOf(ServerSession)
})

test.skip("Get debtor URL", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  expect(debtorUrl).toContain('/debtors/')
})

test.skip("Request debtor info", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  const response = await session.get(debtorUrl as string)
  expect(response.status).toBe(200)
  expect(response.data).toHaveProperty('identity')
})

test.skip("Try to cancel non-existing transfer", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  try {
    await session.post(`${debtorUrl}transfers/123e4567-e89b-12d3-a456-426655440000`)
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError)
    expect(e.status).toBe(404)
    expect(e.url).toContain('123e4567-e89b-12d3-a456-426655440000')
  }
})

test.skip("Try to save document", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
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
    uri: 'https://example.com/debtors/1/',
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
  const isoNow = new Date().toISOString()
  const transfers = [{
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/xxxxxxxxx',
    recipient: { uri: 'swpt:1/2' },
    amount: 1000n,
    transferUuid: 'xxxxxxxxx',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow,
    result: {
      type: 'TransferResult',
      finalizedAt: isoNow,
      committedAmount: 1000n,
    },
  }, {
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/yyyyyyyyy',
    recipient: { uri: 'swpt:1/2' },
    amount: 666n,
    transferUuid: 'yyyyyyyyy',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow,
    result: {
      type: 'TransferResult',
      finalizedAt: isoNow,
      committedAmount: 0n,
      error: {
        type: 'TransferError',
        errorCode: 'TEST_ERROR',
      },
    },
  }]
  const document = {
    uri: 'https://example.com/1/documents/123',
    contentType: 'text/plain',
    content: new ArrayBuffer(4),
  }
  const db = new DebtorsDb();
  await db.storeUserData({ debtor, transfers, document })
  const userId = await db.storeUserData({ debtor, transfers, document })
  const debtorRecord = await db.getDebtorRecord(userId) as DebtorRecord
  expect(debtorRecord.userId).toEqual(userId)
  expect(debtorRecord.config.uri).toBe('config')
  expect(debtorRecord.config).toEqual({ uri: 'config' })
  await expect(db.getUserId(debtor.uri)).resolves.toBeDefined()
  await expect(db.getConfigRecord(userId)).resolves.toEqual({
    ...debtor.config,
    uri: 'https://example.com/debtors/1/config',
    userId,
  })
  await expect(db.getTransferRecords(userId)).resolves.toEqual(
    [{ ...transfers[1], userId, time: new Date(isoNow).getTime() }]
  )
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual({ ...document, userId })
  const actions = await db.getActionRecords(userId)
  expect(actions.length).toBe(1)
  expect(actions[0].actionType).toBe('AbortTransfer')
  await db.deleteActionRecord(actions[0].actionId)
  await expect(db.getActionRecords(userId)).resolves.toEqual([])

  const actionRecord = {
    actionId: undefined,
    userId,
    actionType: 'AbortTransfer',
    createdAt: new Date(),
    uri: 'https://example.com/1/transfers/xxxxxxxx',
  } as const
  await expect(db.getActionRecord(456)).resolves.toBeUndefined()
  await expect(db.createActionRecord({ ...actionRecord, userId: -1 })).rejects.toBeInstanceOf(RecordDoesNotExist)

  let actionId = await db.createActionRecord(actionRecord)
  expect(actionId).toBeDefined()
  expect(actionRecord.actionId).toEqual(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeDefined()
  const ar2 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord(actionId, ar2)).resolves.toBeGreaterThan(actionId)
  expect(ar2.actionId).toBeDefined()
  expect(ar2.actionId).toBeGreaterThan(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeUndefined()
  const ar3 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord(actionId, ar3)).rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getActionRecords(userId)).resolves.toEqual([ar2])
  expect(db.deleteActionRecord(ar2.actionId as any as number)).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  const x = await db.createActionRecord({ ...actionRecord, actionId: undefined })
  await expect(db.getActionRecords(userId)).resolves.toEqual([{ ...actionRecord, actionId: x }])

  const theCreatedTransfer = {
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/123e4567-e89b-12d3-a456-426655440000',
    recipient: { uri: 'swpt:1/2' },
    amount: 777n,
    transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow,
  }
  await expect(db.createTransfer(-1, theCreatedTransfer)).rejects.toBeInstanceOf(RecordDoesNotExist)
  const createTransferActionId = await db.createActionRecord({
    userId,
    actionType: 'CreateTransfer',
    createdAt: new Date(),
    recipient: { uri: 'swpt:1/2' },
    amount: 777n,
    transferUuid: '123e4567-e89b-12d3-a456-426655440000',
  })
  expect(createTransferActionId).toBeDefined()
  const transferRecord = await db.createTransfer(createTransferActionId, theCreatedTransfer)
  expect(transferRecord.time).toBeDefined()
  await expect(db.getActionRecord(createTransferActionId)).resolves.toBe(undefined)

  const theDebtorConfig = {
    type: 'DebtorConfig',
    uri: 'https://example.com/debtors/1/config',
    latestUpdateId: 2n,
    latestUpdateAt: isoNow,
    debtor: { uri: '/debtors/1/' },
    configData: '',
  }
  await expect(db.updateConfig(-1, theDebtorConfig)).rejects.toBeInstanceOf(RecordDoesNotExist)
  const updateConifgActionId = await db.createActionRecord({
    userId,
    actionType: 'UpdateConfig',
    createdAt: new Date(),
    rate: 5.0,
    info: 'http://example.com/document',
  })
  expect(createTransferActionId).toBeDefined()
  const configRecord = await db.updateConfig(updateConifgActionId, theDebtorConfig)
  expect(configRecord.configData).toBeDefined()
  await expect(db.getActionRecord(updateConifgActionId)).resolves.toBe(undefined)

  await db.uninstallUser(userId)
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()
  await expect(db.getDebtorRecord(userId)).rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getConfigRecord(userId)).rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getTransferRecords(userId)).resolves.toEqual([])
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual(undefined)

  const t = transfers[0]
  const time = new Date(t.initiatedAt).getTime()
  await expect((db as any).putTransferRecord(t, userId)).resolves.toEqual(false)
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time })
  await expect((db as any).putTransferRecord(t, userId)).resolves.toEqual(true)
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time })
  await expect((db as any).putTransferRecord(t, userId + 1)).rejects.toBeInstanceOf(Error)
  const alteredUri = t.uri + '/something'
  await expect((db as any).putTransferRecord({ ...t, uri: alteredUri }, userId)).resolves.toEqual(false)
  await expect(db.getTransferRecord(t.uri + '/something')).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON),
  })
})
