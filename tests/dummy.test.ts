import equal from 'fast-deep-equal'
import App from '../src/App.svelte'
import { stringify, parse } from '../src/web-api/json-bigint'
import type { AuthTokenSource } from '../src/web-api/oauth2-token-source'
import { ServerSession, HttpError } from '../src/web-api'
import {
  db,
  DebtorRecord,
  UserDoesNotExist,
  RecordDoesNotExist,
  ActionRecordWithId,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
} from '../src/operations/db'
import {
  parsePaymentRequest,
  parseTransferNote,
  generatePr0Blob,
  generatePayment0TransferNote,
  IvalidPaymentData,
  PaymentDescription,
  MIME_TYPE_PR0,
} from '../src/payment-requests'
import { UpdateScheduler } from '../src/update-scheduler'
import validate from '../src/debtor-info/validate-schema.js'
import { generateCoinInfoBlob, parseDebtorInfoBlob, InvalidDebtorData } from '../src/debtor-info'

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
  const now = Date.now()
  const isoNow = new Date(now).toISOString()
  const isoNow2 = new Date(now + 100).toISOString()
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
    initiatedAt: isoNow2,
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
  const transferUris = ['https://example.com/1/transfers/xxxxxxxxx', 'https://example.com/1/transfers/yyyyyyyyy']
  const document = {
    uri: 'https://example.com/1/documents/123',
    content: '' as any as Blob,  // It seems that "fake-indexeddb" has a problem with Blobs.
  }
  const collectedAfter = new Date()
  await db.storeUserData({ collectedAfter, debtor, transferUris, transfers, document })
  const userId = await db.storeUserData({ collectedAfter, debtor, transferUris, transfers, document })
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
    [{
      ...transfers[1], userId, time: new Date(isoNow2).getTime(),
      paymentInfo: { payeeName: '', payeeReference: '', description: { content: '', contentFormat: '' } }
    },
    {
      ...transfers[0], userId, time: new Date(isoNow).getTime(),
      paymentInfo: { payeeName: '', payeeReference: '', description: { content: '', contentFormat: '' } }
    }]
  )
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual({ ...document, userId })
  const actions = await db.getActionRecords(userId)
  expect(actions.length).toBe(1)
  expect(actions[0].actionType).toBe('AbortTransfer')
  await db.replaceActionRecord(actions[0], null)
  await expect(db.getActionRecords(userId)).resolves.toEqual([])

  const actionRecord = {
    actionId: undefined,
    userId,
    actionType: 'AbortTransfer',
    createdAt: new Date(),
    transferUri: 'https://example.com/1/transfers/xxxxxxxx',
  } as const
  await expect(db.getActionRecord(456)).resolves.toBeUndefined()
  await expect(db.createActionRecord({ ...actionRecord, userId: -1 })).rejects.toBeInstanceOf(UserDoesNotExist)

  let actionId = await db.createActionRecord(actionRecord)
  expect(actionId).toBeDefined()
  expect(actionRecord.actionId).toEqual(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeDefined()
  const ar2 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord({ ...actionRecord, actionId }, ar2)).resolves.toBeUndefined()
  expect(ar2.actionId).toBeDefined()
  expect(ar2.actionId).toBeGreaterThan(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeUndefined()
  const ar3 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord({ ...actionRecord, actionId }, ar3)).rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getActionRecords(userId)).resolves.toEqual([ar2])
  await expect(db.replaceActionRecord(ar2 as any as ActionRecordWithId, null)).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  const x = await db.createActionRecord({ ...actionRecord, actionId: undefined })
  await expect(db.getActionRecords(userId)).resolves.toEqual([{ ...actionRecord, actionId: x }])
  await expect(db.replaceActionRecord(
    { ...actionRecord, actionId: x },
    { ...actionRecord, actionId: x, transferUri: 'https://example.com/1/transfers/updated' },
  )).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([
    { ...actionRecord, actionId: x, transferUri: 'https://example.com/1/transfers/updated' }
  ])
  await expect(db.replaceActionRecord(
    { ...actionRecord, actionId: -1, transferUri: 'https://example.com/1/transfers/updated' },
    { ...actionRecord, actionId: -1, transferUri: 'https://example.com/1/transfers/updated-again' },
  )).rejects.toBeInstanceOf(RecordDoesNotExist)

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
  let createTransferAction = {
    userId,
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(),
    creationRequest: {
      recipient: { uri: 'swpt:1/2' },
      amount: 777n,
      transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    },
    paymentInfo: {
      payeeName: 'XYZ',
      payeeReference: '',
      description: {
        contentFormat: '',
        content: '',
      }
    },
    requestedAmount: 0n,
  }
  await expect(db.createTransferRecord({ ...createTransferAction, actionId: -1 }, theCreatedTransfer))
    .rejects.toBeInstanceOf(RecordDoesNotExist)
  const createTransferActionId = await db.createActionRecord(createTransferAction)
  expect(createTransferActionId).toBeDefined()
  const transferRecord = await db.createTransferRecord(
    createTransferAction as any as CreateTransferActionWithId, theCreatedTransfer)
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

  await expect(db.replaceActionRecord(
    { userId, createdAt: new Date(), actionId: -1, actionType: 'AbortTransfer', transferUri: 'xxx' }, null
  )).rejects.toBeInstanceOf(RecordDoesNotExist)
  const abortTransferAction = {
    userId,
    actionType: 'AbortTransfer' as const,
    createdAt: new Date(),
    transferUri: transfers[1].uri,
  }
  const abortTransferActionId = await db.createActionRecord(abortTransferAction)
  expect(abortTransferActionId).toBeDefined()
  await db.replaceActionRecord(abortTransferAction as AbortTransferActionWithId, null)
  await expect(db.getActionRecord(abortTransferActionId)).resolves.toBe(undefined)
  await expect(db.getTransferRecord(transfers[1].uri)).resolves.toHaveProperty('aborted')

  const paymentInfo = {
    payeeName: '',
    payeeReference: '',
    description: {
      content: '',
      contentFormat: '',
    }
  }
  const t = transfers[0]
  const time = new Date(t.initiatedAt).getTime()
  await expect((db as any).storeTransfer(userId, t)).resolves.toEqual({
    ...t,
    userId,
    time: time,
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time, paymentInfo })
  await expect((db as any).storeTransfer(userId, t)).resolves.toEqual({
    ...t,
    userId,
    time: time,
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time, paymentInfo })
  await expect((db as any).storeTransfer(userId + 1, t)).rejects.toBeInstanceOf(UserDoesNotExist)
  const alteredUri = t.uri + '/something'
  await expect((db as any).storeTransfer(userId, { ...t, uri: alteredUri })).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri + '/something')).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
  })

  await db.uninstallUser(userId)
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()
  await expect(db.getDebtorRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getConfigRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getTransferRecords(userId)).resolves.toEqual([])
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual(undefined)
})

test("Generate payment request", async () => {
  const request = {
    accountUri: 'swpt:124/456',
    payeeName: 'Payee name',
    amount: 1000n,
    deadline: new Date(),
    payeeReference: 'payeeReference',
    description: {
      contentFormat: '',
      content: 'This is a multi-line\ndescription.',
    },
  }
  for (const includeCrc of [true, false]) {
    const blob = generatePr0Blob(request, { includeCrc })
    expect(blob.type).toEqual(MIME_TYPE_PR0)
    const { amount: a1, ...r1 } = await parsePaymentRequest(blob)
    const { amount: a2, ...r2 } = request
    expect(r1).toEqual(r2)
    expect(a1).toEqual(a2)
  }
})

test("Generate and parse payment0 transfer note", async () => {
  const request = {
    accountUri: 'swpt:124/456',
    payeeName: 'Payee name',
    amount: 1000n,
    deadline: new Date(),
    payeeReference: 'payeeReference',
    description: {
      contentFormat: '',
      content: 'This is a multi-line\ndescription.',
    },
  }
  const noteFormat = 'payment0'
  const note = generatePayment0TransferNote(request)
  const r = parseTransferNote({ noteFormat, note })
  expect(r.payeeReference).toEqual('payeeReference')
  expect(r.payeeName).toEqual('Payee name')
  const description = {
    contentFormat: '',
    content: 'This is a multi-line\ndescription.',
  }
  expect(r.description).toEqual(description)
  expect(r.description as PaymentDescription).toEqual(description)
  expect(r.description as PaymentDescription).toEqual(request.description)
  expect(parseTransferNote({ note: 'Hi!\nHere is a payment.', noteFormat: 'unknown' })).toEqual({
    payeeName: '',
    payeeReference: 'Hi!',
    description: {
      contentFormat: 'unknown',
      content: 'Hi!\nHere is a payment.',
    }
  })
  expect(parseTransferNote({ note: 'Hi!', noteFormat: '' })).toEqual({
    'description': {
      'content': 'Hi!',
      'contentFormat': '',
    },
    'payeeName': '',
    'payeeReference': '',
  })
  expect(parseTransferNote({ note: 'A payment for `Santa\nClaus`.', noteFormat: '' })).toEqual({
    'description': {
      'content': 'A payment for `Santa\nClaus`.',
      'contentFormat': '',
    },
    'payeeName': 'Santa Claus',
    'payeeReference': '',
  })
  expect(() => generatePayment0TransferNote(request, 10)).toThrowError(IvalidPaymentData)
})

test("Parse payment0 note", async () => {
  const noteFormat = 'PAYMENT0'
  const note = [
    '12d3a45642665544\n',
    'Payee Name\n',
    'alabala\n',
    'This is a multi-line\ndescription.',
  ].join('')
  const info = parseTransferNote({ note, noteFormat })
  expect(info.payeeReference).toEqual('12d3a45642665544')
  expect(info.payeeName).toEqual('Payee Name')
  expect(info.description.contentFormat).toEqual('alabala')
  expect(info.description.content).toEqual('This is a multi-line\ndescription.')
})

test("Parse payement request", async () => {
  const blob = new Blob([
    'PR0\n',
    '\n',
    'swpt:112233445566778899/998877665544332211\n',
    'Payee Name\n',
    '1000\n',
    '2001-01-01\n',
    '12d3a45642665544\n',
  ])
  const request = await parsePaymentRequest(blob)
  expect(request.payeeName).toEqual('Payee Name')
})

test("Create update scheduler", async () => {
  let run = 0
  let callbacks = 0
  const sch = new UpdateScheduler(async () => run++)
  await (sch as any).updatePromise
  expect((sch as any).updatePromise).toBeUndefined()
  expect(run).toBe(1)
  expect(callbacks).toBe(0);
  sch.schedule(100, () => callbacks++)
  sch.schedule(101, () => callbacks++)
  sch.schedule(99)
  await (sch as any).updatePromise
  expect((sch as any).updatePromise).toBeUndefined()
  expect(run).toBe(1);
  expect(callbacks).toBe(0);
  (sch as any).checkTasks(Date.now() + 200 * 1000)
  await (sch as any).updatePromise
  expect((sch as any).updatePromise).toBeUndefined()
  expect(run).toBe(2)
  expect(callbacks).toBe(2);
  sch.schedule(() => callbacks++)
  await (sch as any).updatePromise
  expect((sch as any).updatePromise).toBeUndefined()
  expect(run).toBe(3)
  expect(callbacks).toBe(3)
  expect((sch as any).tasks.peek()).toBeDefined()
  sch.close()
  sch.close()
})

test("Deep equal", async () => {
  expect(equal({ a: 1n, b: new Date(0) }, { a: 1n, b: new Date(0) })).toBe(true)
  expect(equal({ a: 1n, b: new Date(0) }, { a: 1n, b: new Date(1) })).toBe(false)
  expect(equal({ a: 1n, b: new Date(0) }, { a: 2n, b: new Date(0) })).toBe(false)
  expect(equal({ a: 1n, b: new Date(0) }, undefined)).toBe(false)
})

test("Validate CoinInfo schema", () => {
  expect(validate(1)).toEqual(false)
  expect(validate({ 'type': 'CoinInfo' })).toEqual(false)
  expect(validate({
    type: 'CoinInfo-v1',
    uri: 'https://example.com/0',
    revision: 0,
    willNotChangeUntil: '2021-01-01T10:00:00Z',
    latestDebtorInfo: { uri: 'http://example.com/' },
    summary: "bla-bla",
    debtorIdentity: { type: 'DebtorIdentity', uri: 'swpt:123' },
    debtorName: 'USA',
    debtorHomepage: { uri: 'https://example.com/USA' },
    amountDivisor: 100.0,
    decimalPlaces: 2,
    unit: 'USD',
    peg: {
      type: 'CoinPeg',
      exchangeRate: 1.0,
      debtorIdentity: { type: 'DebtorIdentity', uri: 'swpt:321' },
      latestDebtorInfo: { uri: 'http://example.com/' },
    },
    unknownProp: 1,
  })).toEqual(true)
})

test("Generate and parse CoinInfo", async () => {
  const debtorData = {
    uri: 'https://example.com/0',
    revision: 0,
    willNotChangeUntil: new Date('2021-01-01T10:00:00Z'),
    latestDebtorInfo: { uri: 'http://example.com/' },
    summary: "bla-bla",
    debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:123' },
    debtorName: 'USA',
    debtorHomepage: { uri: 'https://example.com/USA' },
    amountDivisor: 100.0,
    decimalPlaces: 2,
    unit: 'USD',
    peg: {
      type: 'CoinPeg' as const,
      exchangeRate: 1.0,
      debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:321' },
      latestDebtorInfo: { uri: 'http://example.com/' },
    },
    unknownProp: 1,
  }
  const blob = generateCoinInfoBlob(debtorData)
  const { unknownProp, ...noUnknownProp } = debtorData
  await expect(parseDebtorInfoBlob(blob)).resolves.toEqual(noUnknownProp)
  expect(() => generateCoinInfoBlob({ ...debtorData, revision: -1 })).toThrow(InvalidDebtorData)
  expect(() => generateCoinInfoBlob({ ...debtorData, willNotChangeUntil: new Date(NaN) })).toThrow(InvalidDebtorData)
})
