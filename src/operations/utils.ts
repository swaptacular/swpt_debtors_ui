import { db, UserData, isConcludedTransfer } from './db'
import { server, Debtor, Transfer, HttpResponse, TransfersList, RootConfigData } from './server'

function extractDocumentInfoUri(configData: string): string | undefined {
  let data
  try {
    data = JSON.parse(configData) as RootConfigData
  } catch { }
  return data?.info?.iri
}

async function getDebtorInfoDocument(debtor: Debtor): Promise<UserData['document']> {
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

function calcParallelTimeout(numberOfParallelRequests: number): number {
  const n = 6  // a rough guess for the maximum number of parallel connections
  return appConfig.serverApiTimeout * (numberOfParallelRequests + n - 1) / n
}

export async function getUserData(): Promise<UserData> {
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
