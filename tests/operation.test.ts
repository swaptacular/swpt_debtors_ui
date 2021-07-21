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
  const userContext = await obtainUserContext(serverMock)
  assert(userContext)

  const debtorRecord = await userContext.getDebtorRecord()
  expect(debtorRecord.userId).toBe(userContext.userId)
  expect(debtorRecord.config).toEqual({ uri: debtor.config.uri })
})

test("Make a payment", async () => {
  const serverMock = createServerMock(debtor)
  const userContext = await obtainUserContext(serverMock)
  assert(userContext)

  const requestBlob = generatePr0Blob({
    payeeName: 'Payee Name',
    payeeReference: '123',
    description: {
      contentFormat: '',
      content: 'test payment',
    },
    accountUri: 'swpt:1/2',
    amount: 1000n,
  })
  const action = await userContext.processPaymentRequest(requestBlob)
  expect(action.actionId).toBeDefined()
  const transferRecord = await userContext.executeCreateTransferAction(action)
  expect(transferRecord).toBeDefined()

  // TODO: make some asserts
})
