import type { Debtor, Transfer, TransfersList } from '../web-api-schemas'
import { DebtorsDb, UserInstallationData, DebtorRecord, isConcludedTransfer } from './db'
import { ServerSession, HttpResponse, ServerSessionError } from '../web-api'
import { v4 as uuidv4 } from 'uuid';
import { parsePaymentRequest, IvalidPaymentRequest } from './payment-requests'
import type { CreateTransferAction, ActionRecordWithId } from './db'

export { IvalidPaymentRequest }

export class UserDoesNotExist extends Error {
  name = 'UserDoesNotExist'
}

const server = new ServerSession({
  onLoginAttempt: async (login) => {
    if (confirm('This operation requires authentication. You will be redirected to the login page.')) {
      return await login()
    }
    return false
  }
})
const db = new DebtorsDb()

type ConfigData = {
  type?: 'RootConfigData',
  rate: number,
  info: {
    type?: 'DebtorInfo',
    iri: string,
    contentType?: string,
    sha256?: string,  // Example: E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
  }
}

function extractDocumentInfoUri(configData: string): string | undefined {
  let data
  try {
    data = JSON.parse(configData) as ConfigData
  } catch { }
  return data?.info?.iri
}

function calcParallelTimeout(numberOfParallelRequests: number): number {
  const n = 6  // a rough guess for the maximum number of parallel connections
  return appConfig.serverApiTimeout * (numberOfParallelRequests + n - 1) / n
}

async function getDebtorInfoDocument(debtor: Debtor): Promise<UserInstallationData['document']> {
  const uri = extractDocumentInfoUri(debtor.config.configData)
  if (uri !== undefined) {
    let content
    const document = await db.getDocumentRecord(uri)
    if (document) {
      content = document.content
    } else {
      const { headers, data } = await server.getDocument(uri)
      content = new Blob([data], { type: String(headers['content-type']) })
    }
    return { uri, content }
  }
  return undefined
}

async function getUserInstallationData(): Promise<UserInstallationData> {
  const debtorResponse = await server.getEntrypointResponse() as HttpResponse<Debtor>
  const debtor = { ...debtorResponse.data }
  debtor.uri = debtorResponse.buildUri(debtor.uri)

  const transfersListUri = debtorResponse.buildUri(debtor.transfersList.uri)
  const transfersListResponse = await server.get(transfersListUri) as HttpResponse<TransfersList>
  const transfersListItems = transfersListResponse.data.items

  const transferUris = (
    await Promise.all(transfersListItems
      .map(item => transfersListResponse.buildUri(item.uri))
      .map(async uri => {
        const t = await db.getTransferRecord(uri)
        return t && isConcludedTransfer(t) ? undefined : uri
      })
    )
  ).filter(uri => uri !== undefined) as string[]
  const timeout = calcParallelTimeout(transferUris.length)
  const transfers = (
    await Promise.all(transferUris.map(uri => server.get(uri, { timeout }))) as HttpResponse<Transfer>[]
  ).map(response => ({ ...response.data, uri: response.url } as Transfer))

  return {
    debtor,
    transfers,
    document: await getDebtorInfoDocument(debtor),
  }
}

let userIdPromise: Promise<number> | undefined

async function getUserId(): Promise<number> {
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const entrypoint = await server.entrypointPromise
      if (entrypoint === undefined) {
        throw new Error('user not logged in')
      }
      const userId = await db.getUserId(entrypoint)
      if (userId === undefined) {
        throw new Error('user not installed')
      }
      return userId
    })()
  }
  return userIdPromise
}

export async function seeIfLoggedIn(): Promise<boolean> {
  const entrypoint = await server.entrypointPromise
  if (entrypoint === undefined) {
    return false
  }
  let alreadyTriedToUpdate = false
  while (await db.getUserId(entrypoint) === undefined) {
    if (alreadyTriedToUpdate) {
      throw new UserDoesNotExist()
    }
    await update()
    alreadyTriedToUpdate = true
  }
  return true
}

export async function update(): Promise<void> {
  let data
  try {
    data = await getUserInstallationData()
  } catch (e: unknown) {
    if (e instanceof ServerSessionError) return
    throw e
  }

  await db.storeUserData(data)
}

export async function login() {
  await server.login(async (login) => await login())
}

export async function logout() {
  await server.logout()
}

export async function getDebtorRecord(): Promise<DebtorRecord | undefined> {
  let debtorRecord
  const entrypoint = await server.entrypointPromise
  if (entrypoint !== undefined) {
    const userId = await db.getUserId(entrypoint)
    if (userId !== undefined) {
      debtorRecord = db.getDebtorRecord(userId)
    }
  }
  return debtorRecord
}

export async function processPaymentRequest(blob: Blob): Promise<ActionRecordWithId & CreateTransferAction> {
  const request = await parsePaymentRequest(blob)  // may throw `IvalidPaymentRequest`
  const actionRecord = {
    userId: await getUserId(),
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(),
    creationRequest: {
      type: 'TransferCreationRequest',
      recipient: { uri: request.accountUri },
      amount: request.amount,
      transferUuid: uuidv4(),
      noteFormat: 'payeeref',
      note: request.payeeReference,
    },
    paymentInfo: {
      payeeName: request.payeeName,
      paymentRequest: new Blob([blob], { type: request.contentType }),
    }
  }
  await db.createActionRecord(actionRecord)  // This adds actionId to `actionRecord`.
  return actionRecord as ActionRecordWithId & CreateTransferAction
}
