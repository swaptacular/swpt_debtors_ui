import equal from 'fast-deep-equal'
import {
  db,
  DebtorRecord,
  UserDoesNotExist,
  RecordDoesNotExist,
  CreateTransferAction,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
  UpdateConfigActionWithId,
  DeleteTransferTask,
  getCreateTransferActionStatus,
} from '../src/operations/db'

const now = Date.now()
const isoNow = new Date(now).toISOString()
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
const minimalUserData = { debtor, collectedAfter: new Date(), transferUris: [], transfers: [], document }


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
    aborted: false,
  })).toBeTruthy()
  expect(equal(transferRecords[1], {
    ...unsuccessfulTransfer,
    userId,
    time: now * (1 + Number.EPSILON),
    paymentInfo: {
      payeeReference: '123',
      payeeName: 'Payee Name',
      description: { content: 'http://example.com/link', contentFormat: '.' },
    },
    originatesHere: false,
    aborted: false,
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
  const userId = await db.storeUserData(minimalUserData)
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
  const userId = await db.storeUserData(minimalUserData)

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
    aborted: false,
  })).toBeTruthy()
  await expect(db.getActionRecord(actionId)).resolves.toBe(undefined)
  expect(equal(await db.getTransferRecord(transferRecord.uri), transferRecord)).toBeTruthy()
})

test("Store transfers", async () => {
  const userId = await db.storeUserData(minimalUserData)
  const distantFuture = new Date(Date.now() + 1e12)
  expect(db.getTasks(userId, distantFuture)).resolves.toEqual([])

  // fails to store transfer for a non-existing user
  await expect(db.storeTransfer(-1, successfulTransfer)).rejects.toBeInstanceOf(UserDoesNotExist)

  // store a successful transfer
  const successfulTransferRecord = await db.storeTransfer(userId, successfulTransfer)
  expect(successfulTransferRecord.originatesHere).toBe(false)
  expect(successfulTransferRecord.aborted).toBe(false)
  expect(equal(await db.getTransferRecord(successfulTransferRecord.uri), successfulTransferRecord)).toBeTruthy()
  expect(equal(await db.getTransferRecords(userId), [successfulTransferRecord]))
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  const tasks = await db.getTasks(userId, distantFuture)
  expect(tasks.length).toBe(1)
  const task = tasks[0] as DeleteTransferTask
  expect(task.taskType).toBe('DeleteTransfer')
  expect(task.transferUri).toBe(successfulTransfer.uri)

  // storing the same transfer again does nothing
  expect(equal(await db.getTransferRecords(userId), [successfulTransferRecord]))
  await expect(db.getActionRecords(userId)).resolves.toEqual([])

  // store a transfer that is not finalized yet
  const { result, ...notFinalized } = unsuccessfulTransfer
  const notFinalizedTransferRecord = await db.storeTransfer(userId, notFinalized)
  expect(notFinalizedTransferRecord.originatesHere).toBe(false)
  expect(notFinalizedTransferRecord.aborted).toBe(false)
  expect(equal(await db.getTransferRecord(notFinalizedTransferRecord.uri), notFinalizedTransferRecord)).toBeTruthy()
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  expect((await db.getTasks(userId, distantFuture)).length).toBe(1)

  // the not finalized transfer becomes unsuccessful
  const unsuccessfulTransferRecord = await db.storeTransfer(userId, unsuccessfulTransfer)
  expect(unsuccessfulTransferRecord.originatesHere).toBe(false)
  expect(unsuccessfulTransferRecord.aborted).toBe(false)
  expect(equal(
    await db.getTransferRecord(unsuccessfulTransferRecord.uri),
    unsuccessfulTransferRecord
  )).toBeTruthy()
  expect((await db.getTasks(userId, distantFuture)).length).toBe(1)

  // ensure that an abort transfer action has been automatically
  // created for the unsuccessful transfer
  const actionRecords = await db.getActionRecords(userId)
  expect(actionRecords.length).toBe(1)
  const abortTransferAction = actionRecords[0] as AbortTransferActionWithId
  expect(abortTransferAction.actionType).toBe('AbortTransfer')
  expect(abortTransferAction.transferUri).toBe(unsuccessfulTransferRecord.uri)

  // ensure that once the abort transfer action has been deleted, the
  // transfer is marked as aborted, and a transfer deletion task is
  // scheduled.
  await db.replaceActionRecord(abortTransferAction, null)
  await expect(db.getActionRecord(abortTransferAction.actionId)).resolves.toBe(undefined)
  expect(equal(
    await db.getTransferRecord(unsuccessfulTransferRecord.uri),
    { ...unsuccessfulTransferRecord, aborted: true }
  )).toBeTruthy()
  expect((await db.getTasks(userId, distantFuture)).length).toBe(2)

  // Remove all scheduled tasks
  for (const task of await db.getTasks(userId, distantFuture)) {
    await db.removeTask(task.taskId)
  }
  expect(db.getTasks(userId, distantFuture)).resolves.toEqual([])
})

test("Create update config action", async () => {
  const userId = await db.storeUserData(minimalUserData)
  await expect(db.getActionRecords(userId)).resolves.toEqual([])

  const debtorConfigData = {
    interestRate: 5,
    debtorInfo: {
      summary: 'summary',
      debtorName: 'name',
      debtorHomepage: { uri: 'http://example.com/homepage' },
      amountDivisor: 100,
      decimalPlaces: 2,
      unit: 'USD',
      peg: {
        type: 'Peg' as const,
        exchangeRate: 1,
        debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:123' },
        latestDebtorInfo: { uri: 'http://example.com/USD' },
      },
    },
  }

  // create an update config action
  const action = await db.ensureUpdateConfigAction(userId, debtorConfigData) as UpdateConfigActionWithId
  expect(action.actionType).toBe('UpdateConfig')
  expect(action.interestRate).toBe(debtorConfigData.interestRate)
  expect(action.debtorInfo).toBe(debtorConfigData.debtorInfo)
  await expect(db.getActionRecords(userId)).resolves.toEqual([action])

  // fails to create another update config action for the same user
  const changedDebtorConfigData = { ...debtorConfigData, interestRate: -5 }
  const anotherAction = await db.ensureUpdateConfigAction(userId, changedDebtorConfigData) as UpdateConfigActionWithId
  expect(anotherAction).toEqual(action)
  await expect(db.getActionRecords(userId)).resolves.toEqual([action])
})

test("Update user's config record", async () => {
  const userId = await db.storeUserData(minimalUserData)
  const config = {
    uri: 'https://example.com/debtors/1/config',
    latestUpdateAt: '2020-01-02T00:00:00Z',
    latestUpdateId: 2n,
    configData: '{"info": {"iri": "https://example.com/1/documents/124"}}',
    debtor: { uri: 'https://example.com/1/' }
  }

  // fails to update the config record of a non-existing user
  await expect(db.updateConfigRecord(-1, config)).rejects.toBeInstanceOf(UserDoesNotExist)

  // updates the config record
  const updatedConfigRecord = await db.updateConfigRecord(userId, config)
  expect(equal(updatedConfigRecord, await db.getConfigRecord(userId))).toBeTruthy()
  expect(equal(updatedConfigRecord, { ...config, userId })).toBeTruthy()
})

test("Store a document", async () => {
  const userId = await db.storeUserData(minimalUserData)

  const uri = 'https://example.com/1/documents/124'
  const documentRecord = {
    userId,
    uri,
    content: new ArrayBuffer(0),
    contentType: 'text/plain',
    sha256: '0'.repeat(64),
  }

  // fails to store a document for a non-existing user
  await expect(db.putDocumentRecord({ ...documentRecord, userId: -1 })).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getDocumentRecord(uri)).resolves.toBeUndefined()

  // successfully store a document
  await expect(db.putDocumentRecord(documentRecord)).resolves.toBeUndefined()
  await expect(db.getDocumentRecord(uri)).resolves.toEqual(documentRecord)

  // storing the same document again does nothing
  await expect(db.putDocumentRecord(documentRecord)).resolves.toBeUndefined()
  await expect(db.getDocumentRecord(uri)).resolves.toEqual(documentRecord)
})

test("Get create transfer action status", async () => {
  let createTransferAction = {
    userId: -1,
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(now),
    paymentInfo: {
      payeeName: '',
      payeeReference: '',
      description: {
        contentFormat: '',
        content: '',
      }
    },
    creationRequest: {
      recipient: { uri: 'swpt:1/2' },
      amount: 777n,
      transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    },
    requestedAmount: 0n,
  } as CreateTransferAction

  expect(getCreateTransferActionStatus(createTransferAction
  )).toBe('Draft')

  expect(getCreateTransferActionStatus({
    ...createTransferAction,
    execution: { startedAt: new Date(now) }
  })).toBe('Not sent')

  expect(getCreateTransferActionStatus({
    ...createTransferAction,
    execution: { startedAt: new Date(now), unresolvedRequestAt: new Date(now) }
  })).toBe('Not confirmed')

  expect(getCreateTransferActionStatus({
    ...createTransferAction,
    execution: { startedAt: new Date(now), result: { ok: true, transferUri: 'http://example.com/transfer' } }
  })).toBe('Initiated')

  expect(getCreateTransferActionStatus({
    ...createTransferAction,
    execution: { startedAt: new Date(now), result: { ok: false, errors: [] } }
  })).toBe('Failed')

  expect(getCreateTransferActionStatus({
    ...createTransferAction,
    execution: { startedAt: new Date(now - 1e12) }
  })).toBe('Timed out')
})
