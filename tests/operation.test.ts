import equal from 'fast-deep-equal'
import { AbortTransferActionWithId, db } from '../src/operations/db'
import { login, logout, update, obtainUserContext } from '../src/operations'
import { createServerMock } from './server-mock'
import { generatePr0Blob } from '../src/payment-requests'
import { generateCoinInfoDocument, MIME_TYPE_COIN_INFO } from '../src/debtor-info'

const updatSchedulerMock = {
  latestUpdateAt: new Date(),
  schedule: jest.fn(),
  close: jest.fn(),
} as any

// All example URIs must be absolute.
const debtor = {
  type: 'Debtor',
  uri: 'https://example.com/debtors/1/',
  createTransfer: { uri: 'https://example.com/debtors/1/transfers/' },
  saveDocument: { uri: 'https://example.com/debtors/1/documents/' },
  publicInfoDocument: { uri: 'https:/example.com/debtors/1/public' },
  transfersList: { uri: 'https://example.com/debtors/1/transfers/' },
  noteMaxBytes: 200n,
  identity: { type: 'DebtorIdentity', uri: 'swpt:1' },
  balance: 20000n,
  createdAt: '2020-01-01T00:00:00Z',
  config: {
    type: 'DebtorConfig',
    uri: 'https://example.com/debtors/1/config',
    latestUpdateAt: '2020-01-01T00:00:00Z',
    latestUpdateId: 1n,
    configData: '{"rate": 5, "info": {"iri": "https://example.com/debtors/1/documents/0/public"}}',
    debtor: { uri: 'https://example.com/debtors/1/' }
  },
}

const now = Date.now()
const isoNow = new Date(now).toISOString()
const unsuccessfulTransfer = {
  type: 'Transfer',
  uri: 'https://example.com/1/transfers/123e4567-e89b-12d3-a456-426614174000',
  recipient: { uri: 'swpt:1/2' },
  amount: 666n,
  transferUuid: '123e4567-e89b-12d3-a456-426614174000',
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

const delayedTranfer = {
  type: 'Transfer',
  uri: 'https://example.com/1/transfers/123e4567-e89b-12d3-a456-426614174001',
  recipient: { uri: 'swpt:1/2' },
  amount: 666n,
  transferUuid: '123e4567-e89b-12d3-a456-426614174001',
  transfersList: { uri: 'https://example.com/1/transfers/' },
  note: '124\nPayee Name\n.\nhttp://example.com/link',
  noteFormat: 'payment0',
  initiatedAt: new Date(0).toISOString(),
}

const debtorData = {
  uri: 'https:/example.com/1/documents/0/public',
  revision: 0,
  willNotChangeUntil: new Date('2021-01-01T10:00:00Z'),
  latestDebtorInfo: { uri: 'https://example.com/example.com/1/public' },
  summary: "bla-bla",
  debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:1' },
  debtorName: 'USA',
  debtorHomepage: { uri: 'https://example.com/USA' },
  amountDivisor: 100.0,
  decimalPlaces: 2,
  unit: 'USD',
  peg: undefined,
}

const paymentRequest = {
  payeeName: 'Payee Name',
  payeeReference: 'payee-reference',
  description: {
    contentFormat: '',
    content: 'test payment',
  },
  accountUri: 'swpt:1/2',
  amount: 1000n,
}

const requestBlob = generatePr0Blob(paymentRequest)

beforeEach(async () => {
  await db.clearAllTables()
})

test("Login", async () => {
  const serverMock = createServerMock(debtor)
  await login(serverMock)
  expect(serverMock.login.mock.calls.length).toBe(1)
})

test("Logout", async () => {
  const serverMock = createServerMock(debtor)
  await logout(serverMock)
  expect(serverMock.logout.mock.calls.length).toBe(1)
})

test("Get debtor's record", async () => {
  const serverMock = createServerMock(debtor)
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  const debtorRecord = await uc.getDebtorRecord()
  expect(debtorRecord.userId).toBe(uc.userId)
  expect(debtorRecord.config).toEqual({ uri: debtor.config.uri })
})

test("Make a payment", async () => {
  const serverMock = createServerMock(debtor)
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  // create a payment draft
  const action = await uc.processPaymentRequest(requestBlob)
  expect(action.actionId).toBeDefined()
  expect(equal(await uc.getActionRecords(), [action])).toBeTruthy()
  expect(equal(await uc.getTransferRecords(), [])).toBeTruthy()
  expect(serverMock.post.mock.calls.length).toBe(0)

  // send the payment
  const transferRecord = await uc.executeCreateTransferAction(action)
  expect(serverMock.post.mock.calls.length).toBe(1)
  expect(equal(
    [...serverMock.post.mock.calls[0]],
    [
      debtor.createTransfer.uri,
      {
        type: 'TransferCreationRequest',
        recipient: { uri: paymentRequest.accountUri },
        amount: paymentRequest.amount,
        transferUuid: transferRecord.transferUuid,
        noteFormat: transferRecord.noteFormat,
        note: transferRecord.note,
      },
      { attemptLogin: true },
    ]
  )).toBeTruthy()
  expect(equal(await uc.getActionRecords(), [])).toBeTruthy()
  expect(equal(await uc.getTransferRecords(), [transferRecord])).toBeTruthy()
  expect(transferRecord.originatesHere).toBe(true)
  expect(transferRecord.aborted).toBe(false)
  expect(transferRecord.recipient.uri).toBe('swpt:1/2')
  expect(transferRecord.amount).toBe(1000n)
  expect(transferRecord.note).toContain('payee-reference')
  expect(transferRecord.paymentInfo.payeeName).toBe('Payee Name')
})

test("Cancel a payment draft", async () => {
  const serverMock = createServerMock(debtor)
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  const action = await uc.processPaymentRequest(requestBlob)
  await uc.deleteCreateTransferAction(action)
  expect(serverMock.post.mock.calls.length).toBe(0)
  expect(equal(await uc.getActionRecords(), [])).toBeTruthy()
  expect(equal(await uc.getTransferRecords(), [])).toBeTruthy()
})

test("Dismiss unsuccessful transfer", async () => {
  const serverMock = createServerMock(debtor, [unsuccessfulTransfer])
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  // fetch the unsuccessful transfer from the server
  await update(serverMock)
  const transferRecords = await uc.getTransferRecords()
  expect(transferRecords.length).toBe(1)
  expect(transferRecords[0].transferUuid).toBe(unsuccessfulTransfer.transferUuid)
  expect(transferRecords[0].originatesHere).toBe(false)
  expect(transferRecords[0].aborted).toBe(false)
  expect(transferRecords[0].result?.committedAmount).toBe(0n)

  // get the automatically created abort transfer action
  const actionRecords = await uc.getActionRecords()
  expect(actionRecords.length).toBe(1)
  const abortTransferAction = actionRecords[0] as AbortTransferActionWithId
  expect(abortTransferAction.actionType).toBe('AbortTransfer')
  expect(abortTransferAction.transferUri).toBe(unsuccessfulTransfer.uri)

  // retrying the unsuccessful transfer replaces the abort transfer
  // action with a create transfer action, and marks the transfer
  // record as aborted.
  const createTransferAction = await uc.retryTransfer(abortTransferAction)
  expect(await uc.getActionRecords()).toEqual([createTransferAction])
  expect(createTransferAction.actionId !== abortTransferAction.actionId).toBeTruthy()
  const transferRecord = await uc.getTransferRecord(abortTransferAction.transferUri)
  expect(transferRecord).toBeDefined()
  assert(transferRecord)
  expect(transferRecord.transferUuid).toBe(unsuccessfulTransfer.transferUuid)
  expect(transferRecord.aborted).toBe(true)

  // retrying the unsuccessful transfer again creates another create
  // transfer action, leaving the previous action intact
  const anotherCreateTransferAction = await uc.retryTransfer(abortTransferAction)
  expect(anotherCreateTransferAction.actionId !== createTransferAction.actionId).toBeTruthy()
  expect((await uc.getActionRecords()).length).toBe(2)
})

test("Cancel and dismiss delayed transfer", async () => {
  const serverMock = createServerMock(debtor, [delayedTranfer])
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  // fetch the delayed transfer from the server
  await update(serverMock)
  const transferRecords = await uc.getTransferRecords()
  expect(transferRecords.length).toBe(1)
  expect(transferRecords[0].transferUuid).toBe(delayedTranfer.transferUuid)
  expect(transferRecords[0].originatesHere).toBe(false)
  expect(transferRecords[0].aborted).toBe(false)
  expect(transferRecords[0].result).toBeUndefined()

  // get the automatically created abort transfer action
  const actionRecords = await uc.getActionRecords()
  expect(actionRecords.length).toBe(1)
  const abortTransferAction = actionRecords[0] as AbortTransferActionWithId
  expect(abortTransferAction.actionType).toBe('AbortTransfer')
  expect(abortTransferAction.transferUri).toBe(delayedTranfer.uri)

  // try to cancel the delayed transfer
  const isCanceled = await uc.cancelTransfer(abortTransferAction)
  expect(isCanceled).toBe(false)
  expect(serverMock.post.mock.calls.length).toBe(1)
  expect(equal(
    [...serverMock.post.mock.calls[0]],
    [
      delayedTranfer.uri,
      { type: 'TransferCancelationRequest' },
      { attemptLogin: true },
    ]
  )).toBeTruthy()

  // dismiss the delayed transfer
  const transferRecord = await uc.dismissTransfer(abortTransferAction)
  expect(await uc.getActionRecords()).toEqual([])
  expect(transferRecord.transferUuid).toBe(delayedTranfer.transferUuid)
  expect(transferRecord.aborted).toBe(true)

  // dismiss the delayed transfer again (works, but does nothing)
  expect(equal(transferRecord, await uc.dismissTransfer(abortTransferAction))).toBeTruthy()
})

test("Create and delete update config action", async () => {
  const serverMock = createServerMock(debtor, [], await generateCoinInfoDocument(debtorData))
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  // get debtor's config data
  const debtorConfigData = await uc.getDebtorConfigData()
  expect(debtorConfigData.interestRate).toBe(5)
  expect(debtorConfigData.debtorInfo?.summary).toBe(debtorData.summary)
  expect(debtorConfigData.debtorInfo?.debtorName).toBe(debtorData.debtorName)
  expect(debtorConfigData.debtorInfo?.debtorHomepage).toEqual(debtorData.debtorHomepage)
  expect(debtorConfigData.debtorInfo?.amountDivisor).toBe(debtorData.amountDivisor)
  expect(debtorConfigData.debtorInfo?.decimalPlaces).toBe(debtorData.decimalPlaces)
  expect(debtorConfigData.debtorInfo?.unit).toBe(debtorData.unit)
  expect(debtorConfigData.debtorInfo?.peg).toEqual(debtorData.peg)
  expect(debtorConfigData.debtorInfoRevision).toBe(0)

  // create an update config action
  const updateConfigAction = await uc.editDebtorConfigData(debtorConfigData)
  expect(await uc.getActionRecords()).toEqual([updateConfigAction])

  // delete the created update config action
  await uc.deleteUpdateConfigAction(updateConfigAction)
  expect(await uc.getActionRecords()).toEqual([])
})

test("Edit and execute an update config action", async () => {
  const serverMock = createServerMock(debtor, [], await generateCoinInfoDocument(debtorData))
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  const originalLatestUpdateId = debtor.config.latestUpdateId
  const debtorConfigData = await uc.getDebtorConfigData()
  const updateConfigAction = await uc.editDebtorConfigData(debtorConfigData)
  assert(updateConfigAction.debtorInfo)

  // edit the config
  const editedUpdateConfigAction = {
    ...updateConfigAction,
    interestRate: 6,
    debtorInfo: {
      ...updateConfigAction.debtorInfo,
      debtorName: 'Updated name',
    }
  }
  await uc.replaceActionRecord(updateConfigAction, editedUpdateConfigAction)

  // execute the update config action
  await uc.executeUpdateConfigAction(editedUpdateConfigAction)
  expect(await uc.getActionRecords()).toEqual([])
  const editedDebtorConfigData = await uc.getDebtorConfigData()
  expect(editedDebtorConfigData.interestRate).toBe(6)
  expect(editedDebtorConfigData.debtorInfo?.debtorName).toBe('Updated name')
  expect(editedDebtorConfigData.debtorInfoRevision).toEqual(debtorConfigData.debtorInfoRevision + 1)

  // assert a new docuemnt is saved to the server
  expect(serverMock.post.mock.calls.length).toBe(1)
  expect(serverMock.post.mock.calls[0][0]).toBe(debtor.saveDocument.uri)
  expect(serverMock.post.mock.calls[0][1].buffer instanceof ArrayBuffer).toBeTruthy()
  const headers = (await serverMock.post.mock.results[0].value).headers
  expect(headers.location).toContain(debtor.uri)
  expect(headers['content-type']).toBe(MIME_TYPE_COIN_INFO)

  // assert a config update request is made to the server
  expect(serverMock.patch.mock.calls.length).toBe(1)
  expect(serverMock.patch.mock.calls[0][0]).toBe(debtor.config.uri)
  expect(serverMock.patch.mock.calls[0][1].type).toBe('DebtorConfig')
  expect(serverMock.patch.mock.calls[0][1].latestUpdateId).toBe(originalLatestUpdateId + 1n)
  expect(serverMock.patch.mock.calls[0][1].configData).toContain('"rate":6')
  expect(serverMock.patch.mock.calls[0][1].configData).toContain(headers.location)
})

test("Delete old successful transfer", async () => {
  const oldSuccessfulTransfer = {
    ...delayedTranfer,
    result: {
      type: 'TransferResult',
      finalizedAt: '1970-01-01T00:00:00.000Z',
      committedAmount: 666n,
    }
  }
  const serverMock = createServerMock(debtor, [oldSuccessfulTransfer])
  const uc = await obtainUserContext(serverMock, updatSchedulerMock)
  assert(uc)

  // fetch the old unsuccessful transfer from the server, and ensure
  // that it has been deleted from the server
  await update(serverMock)
  expect(serverMock.delete.mock.calls.length).toBe(1)
  expect(serverMock.delete.mock.calls[0][0]).toBe(oldSuccessfulTransfer.uri)

  // ensure that executing another update does not try to delete the
  // transfer from the server once again
  await update(serverMock)
  expect(serverMock.delete.mock.calls.length).toBe(1)
})
