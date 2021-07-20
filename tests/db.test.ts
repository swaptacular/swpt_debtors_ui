import equal from 'fast-deep-equal'
import {
  db,
  DebtorRecord,
  UserDoesNotExist,
  RecordDoesNotExist,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
} from '../src/operations/db'

const now = Date.now()
const isoNow = new Date(now).toISOString()
const isoNowPlus = new Date(now + 100).toISOString()
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
    configData: '{"info": {"iri": "https://example.com/1/documents/123"}}',
    debtor: { uri: 'https://example.com/1/' }
  },
}
const successfulTransfer = {
  type: 'Transfer',
  uri: 'https://example.com/1/transfers/-successul-',
  recipient: { uri: 'swpt:1/2' },
  amount: 1000n,
  transferUuid: '-successul-',
  transfersList: { uri: 'https://example.com/1/transfers/' },
  note: '',
  noteFormat: '',
  initiatedAt: isoNow,
  result: {
    type: 'TransferResult',
    finalizedAt: isoNow,
    committedAmount: 1000n,
  },
}
const unsuccessfulTransfer = {
  type: 'Transfer',
  uri: 'https://example.com/1/transfers/-unsuccessul-',
  recipient: { uri: 'swpt:1/2' },
  amount: 666n,
  transferUuid: '-unsuccessul-',
  transfersList: { uri: 'https://example.com/1/transfers/' },
  note: '123\nPayee Name\n.\nhttp://example.com/link',
  noteFormat: 'payment0',
  initiatedAt: isoNowPlus,
  result: {
    type: 'TransferResult',
    finalizedAt: isoNow,
    committedAmount: 0n,
    error: {
      type: 'TransferError',
      errorCode: 'TEST_ERROR',
    },
  },
}
const transfers = [
  successfulTransfer,
  unsuccessfulTransfer,
]
const transferUris = [
  successfulTransfer.uri,
  unsuccessfulTransfer.uri,
]
const document = {
  uri: 'https://example.com/1/documents/123',
  contentType: 'text/plain',
  content: new ArrayBuffer(0),
  sha256: '',
}
const userData = { debtor, collectedAfter: new Date(), transferUris, transfers, document }

beforeEach(async () => {
  await db.clearAllTables()
})

test("Install and uninstall user", async () => {
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()

  const userId = await db.storeUserData(userData)
  await expect(db.getUserId(debtor.uri)).resolves.toEqual(userId)

  const debtorRecord = await db.getDebtorRecord(userId) as DebtorRecord
  expect(equal(debtorRecord, {
    ...debtor,
    config: { uri: 'config' },
    userId,
  })).toBeTruthy()

  const configRecord = await db.getConfigRecord(userId)
  expect(equal(configRecord, {
    ...debtor.config,
    uri: 'https://example.com/debtors/1/config',
    userId,
  })).toBeTruthy()

  const transferRecords = (await db.getTransferRecords(userId)).sort((a, b) => a.time - b.time)
  expect(transferRecords.length).toBe(2)
  expect(equal(transferRecords[0], {
    ...successfulTransfer,
    userId,
    time: new Date(isoNow).getTime(),
    paymentInfo: {
      payeeReference: '',
      payeeName: '',
      description: { content: '', contentFormat: '' },
    },
    originatesHere: false,
  })).toBeTruthy()
  expect(equal(transferRecords[1], {
    ...unsuccessfulTransfer,
    userId,
    time: new Date(isoNowPlus).getTime(),
    paymentInfo: {
      payeeReference: '123',
      payeeName: 'Payee Name',
      description: { content: 'http://example.com/link', contentFormat: '.' },
    },
    originatesHere: false,
  })).toBeTruthy()

  const documentRecord = await db.getDocumentRecord('https://example.com/1/documents/123')
  expect(documentRecord).toEqual({ ...document, userId })

  const actionRecords = await db.getActionRecords(userId) as AbortTransferActionWithId[]
  expect(actionRecords.length).toBe(1)
  expect(actionRecords[0].actionType).toBe('AbortTransfer')
  expect(actionRecords[0].transferUri).toBe('https://example.com/1/transfers/-unsuccessul-')

  await db.uninstallUser(userId)
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()
  await expect(db.getDebtorRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getConfigRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getTransferRecords(userId)).resolves.toEqual([])
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual(undefined)
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
})

test("Create and replace action records", async () => {
  const userId = await db.storeUserData({ debtor, collectedAfter: new Date(), transferUris: [], transfers: [], document })
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  await expect(db.getActionRecords(-1)).resolves.toEqual([])

  const originalActionRecord = {
    actionId: undefined,
    userId,
    actionType: 'AbortTransfer',
    createdAt: new Date(),
    transferUri: 'NOT UPDATED',
  } as const
  let actionRecord = { ...originalActionRecord } as any as AbortTransferActionWithId

  // fails to create action for non-existing user
  await expect(db.createActionRecord({ ...actionRecord, userId: -1 })).rejects.toBeInstanceOf(UserDoesNotExist)

  // create the action
  const actionId = await db.createActionRecord(actionRecord)
  expect(actionId).toBeDefined()
  expect({ ...originalActionRecord, actionId }).toEqual(actionRecord)
  await expect(db.getActionRecord(actionId)).resolves.toEqual(actionRecord)
  await expect(db.getActionRecords(userId)).resolves.toEqual([actionRecord])

  // replace the action record
  const replacement = { ...actionRecord, actionId: undefined } as any
  await expect(db.replaceActionRecord(actionRecord, replacement)).resolves.toBeUndefined()
  const replacementActionId = replacement.actionId as any
  expect(replacementActionId).toBeDefined()
  expect(replacementActionId).toBeGreaterThan(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeUndefined()
  await expect(db.getActionRecord(replacementActionId)).resolves.toEqual(replacement)
  await expect(db.getActionRecords(userId)).resolves.toEqual([replacement])

  // fails to replace an already replaced record
  await expect(db.replaceActionRecord(actionRecord, { ...actionRecord, actionId: undefined }))
    .rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getActionRecords(userId)).resolves.toEqual([replacement])

  // update the repacement
  const updatedReplacement = { ...replacement, transferUri: 'UPDATED' }
  await expect(db.replaceActionRecord(replacement, updatedReplacement)).resolves.toBeUndefined()
  expect(replacement.actionId).toBe(replacementActionId)
  expect(replacement.transferUri).toBe('NOT UPDATED')
  expect(updatedReplacement.actionId).toBe(replacementActionId)
  expect(updatedReplacement.transferUri).toBe('UPDATED')
  await expect(db.getActionRecord(replacementActionId)).resolves.toEqual(updatedReplacement)
  await expect(db.getActionRecords(userId)).resolves.toEqual([updatedReplacement])

  // fails to delete an updated record
  await expect(db.replaceActionRecord(replacement, null)).rejects.toBeInstanceOf(RecordDoesNotExist)

  // delete the updated replacement
  await expect(db.replaceActionRecord(updatedReplacement, null)).resolves.toBeUndefined()
  await expect(db.getActionRecord(replacementActionId)).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
})

test("Perform a create transfer action", async () => {
  const userId = await db.storeUserData({ debtor, collectedAfter: new Date(), transferUris: [], transfers: [], document })

  let paymentInfo = {
    payeeName: 'XYZ',
    payeeReference: '123',
    description: {
      contentFormat: '.',
      content: 'http://example.com/link',
    }
  }
  let createTransferAction = {
    userId,
    paymentInfo,
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(),
    creationRequest: {
      recipient: { uri: 'swpt:1/2' },
      amount: 777n,
      transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    },
    requestedAmount: 0n,
  } as CreateTransferActionWithId
  const theCreatedTransfer = {
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/123e4567-e89b-12d3-a456-426655440000',
    recipient: { uri: 'swpt:1/2' },
    amount: 777n,
    transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '123\nXYZ\n.\nhttp://example.com/link',
    noteFormat: 'payment0',
    initiatedAt: isoNow,
  }

  // create an action record
  const actionId = await db.createActionRecord(createTransferAction)

  // fails to create a transfer record for a non-existing action record
  await expect(db.createTransferRecord({ ...createTransferAction, actionId: -1 }, theCreatedTransfer))
    .rejects.toBeInstanceOf(RecordDoesNotExist)

  // create a transfer record
  const transferRecord = await db.createTransferRecord(createTransferAction, theCreatedTransfer)
  expect(transferRecord.time).toBeDefined()
  expect(transferRecord.originatesHere).toBe(true)
  expect(transferRecord.paymentInfo).toEqual(paymentInfo)
  expect(equal(transferRecord, {
    ...theCreatedTransfer,
    userId,
    paymentInfo,
    time: transferRecord.time,
    originatesHere: true,
  })).toBeTruthy()
  await expect(db.getActionRecord(actionId)).resolves.toBe(undefined)
  expect(equal(await db.getTransferRecord(transferRecord.uri), transferRecord)).toBeTruthy()
})

test("All in", async () => {
  const userId = await db.storeUserData(userData)
  const actions = await db.getActionRecords(userId)
  await db.replaceActionRecord(actions[0], null)

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
  db.storeTransfer(userId, theCreatedTransfer)

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
    interestRate: 5.0,
    debtorInfo: {
      debtorName: 'USA',
      amountDivisor: 100,
      decimalPlaces: 2,
      unit: 'USD',
    },
  })
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
    originatesHere: false,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({
    ...t,
    userId,
    time,
    paymentInfo,
    originatesHere: false,
  })
  await expect((db as any).storeTransfer(userId, t)).resolves.toEqual({
    ...t,
    userId,
    time: time,
    paymentInfo,
    originatesHere: false,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({
    ...t,
    userId,
    time,
    paymentInfo,
    originatesHere: false,
  })
  await expect((db as any).storeTransfer(userId + 1, t)).rejects.toBeInstanceOf(UserDoesNotExist)
  const alteredUri = t.uri + '/something'
  await expect((db as any).storeTransfer(userId, { ...t, uri: alteredUri })).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
    originatesHere: false,
  })
  await expect(db.getTransferRecord(t.uri + '/something')).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
    originatesHere: false,
  })
})
