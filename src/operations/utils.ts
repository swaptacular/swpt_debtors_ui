import { db, UserData } from './db'
import { server, Debtor, Transfer, HttpResponse, TransfersList, RootConfigData } from './server'
import { calcSha256 } from '../debtor-info'

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
    const documentRecord = await db.getDocumentRecord(uri)
    if (documentRecord) {
      const { userId, ...document } = documentRecord
      return document
    } else {
      const { headers, data } = await server.getDocument(uri)
      return {
        uri,
        contentType: String(headers['content-type']),
        content: data,
        sha256: await calcSha256(data),
      }
    }
  }
  return undefined
}

function calcParallelTimeout(numberOfParallelRequests: number): number {
  const n = 6  // a rough guess for the maximum number of parallel connections
  return appConfig.serverApiTimeout * (numberOfParallelRequests + n - 1) / n
}

export async function getUserData(getTransfers = true): Promise<UserData> {
  const collectedAfter = new Date()

  const debtorResponse = await server.getEntrypointResponse() as HttpResponse<Debtor>
  const debtor = { ...debtorResponse.data }

  const transfersListUri = debtorResponse.buildUri(debtor.transfersList.uri)
  const transfersListResponse = await server.get(transfersListUri) as HttpResponse<TransfersList>
  const transferUris = transfersListResponse.data.items.map(item => transfersListResponse.buildUri(item.uri))

  let transfers
  if (getTransfers) {
    const unconcludedTransferUris = (
      await Promise.all(transferUris.map(async uri => await db.isConcludedTransfer(uri) ? undefined : uri))
    ).filter(uri => uri !== undefined) as string[]
    const timeout = calcParallelTimeout(unconcludedTransferUris.length)
    transfers = (
      await Promise.all(unconcludedTransferUris.map(uri => server.get(uri, { timeout }))) as HttpResponse<Transfer>[]
    ).map(response => ({ ...response.data, uri: response.url } as Transfer))
  }

  return {
    collectedAfter,
    debtor,
    transferUris,
    transfers,
    document: await getDebtorInfoDocument(debtor),
  }
}
