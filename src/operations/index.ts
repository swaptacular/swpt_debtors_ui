import type { Debtor, Transfer, TransfersList } from '../web-api-schemas'
import { LocalDb, UserInstallationData, DebtorRecord } from '../db'
import { ServerSession, HttpResponse, ServerSessionError } from '../web-api'

const server = new ServerSession({
  onLoginAttempt: async (login) => {
    if (confirm('This operation requires authentication. You will be redirected to the login page.')) {
      return await login()
    }
    return false
  }
})
const db = new LocalDb()

type ConfigData = {
  type?: 'RootConfigData',
  rate: number,
  info: {
    type?: 'DebtorInfo',
    iri: string,
    contentType?: string,
    sha256?: string,
  }
}


function extractDocumentInfoUri(configData: string): string | undefined {
  let data
  try {
    data = JSON.parse(configData) as ConfigData
  } catch { }
  return data?.info?.iri
}


async function getUserInstallationData(): Promise<UserInstallationData> {
  const entrypointResponse = await server.getEntrypointResponse() as HttpResponse<Debtor>
  const debtor = { ...entrypointResponse.data, uri: entrypointResponse.url }

  const {
    url: transfersListUri,
    data: transfersList,
  } = await server.get(new URL(debtor.transfersList.uri, debtor.uri).href) as HttpResponse<TransfersList>

  const n = 6  // a rough guess for the maximum number of parallel connections
  const timeout = appConfig.serverApiTimeout * (transfersList.items.length + n - 1) / n
  const transfers = (
    await Promise.all(transfersList
      .items
      .map(item => new URL(item.uri, transfersListUri).href)
      .filter(uri => !db.isConcludedTransfer(uri))
      .map(uri => server.get(uri, { timeout }))
    ) as HttpResponse<Transfer>[]
  ).map(response => ({ ...response.data, uri: response.url } as Transfer))

  async function getInfoDocument() {
    const uri = extractDocumentInfoUri(debtor.config.configData)
    if (uri !== undefined) {
      const document = await db.getDocument(uri)
      if (document) {
        const { uri, contentType, content } = document
        return { uri, contentType, content }
      } else {
        const { headers, data } = await server.getDocument(uri)
        return { uri, contentType: String(headers['content-type']), content: data }
      }
    }
    return undefined
  }

  return {
    debtor,
    transfers,
    document: await getInfoDocument(),
  }
}


export async function determineIfLoggedIn(): Promise<boolean> {
  return await server.entrypointPromise !== undefined
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
