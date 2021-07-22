import equal from 'fast-deep-equal'
import { db } from '../src/operations/db'
import { login, logout, obtainUserContext } from '../src/operations'
import { createServerMock } from './server-mock'
import { generatePr0Blob } from '../src/payment-requests'


// Here all URIs must be absolute.
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
  const uc = await obtainUserContext(serverMock)
  assert(uc)

  const debtorRecord = await uc.getDebtorRecord()
  expect(debtorRecord.userId).toBe(uc.userId)
  expect(debtorRecord.config).toEqual({ uri: debtor.config.uri })
})

test("Make a payment", async () => {
  const serverMock = createServerMock(debtor)
  const uc = await obtainUserContext(serverMock)
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
  const uc = await obtainUserContext(serverMock)
  assert(uc)

  const action = await uc.processPaymentRequest(requestBlob)
  await uc.deleteCreateTransferAction(action)
  expect(serverMock.post.mock.calls.length).toBe(0)
  expect(equal(await uc.getActionRecords(), [])).toBeTruthy()
  expect(equal(await uc.getTransferRecords(), [])).toBeTruthy()
})
