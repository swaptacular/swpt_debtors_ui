import equal from 'fast-deep-equal'
import { AbortTransferActionWithId, db } from '../src/operations/db'
import { login, logout, update, obtainUserContext } from '../src/operations'
import { createServerMock } from './server-mock'
import { generatePr0Blob } from '../src/payment-requests'

const updatSchedulerMock = {
  latestUpdateAt: new Date(),
  schedule: jest.fn(),
  close: jest.fn(),
} as any

// All example URIs must be absolute.
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
    type: 'DebtorConfig',
    uri: 'https://example.com/debtors/1/config',
    latestUpdateAt: '2020-01-01T00:00:00Z',
    latestUpdateId: 1n,
    configData: '{"info": {"iri": "https://example.com/1/documents/123"}}',
    debtor: { uri: 'https://example.com/1/' }
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

test("Abort unsuccessful transfer", async () => {
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

test("Abort delayed transfer", async () => {
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
