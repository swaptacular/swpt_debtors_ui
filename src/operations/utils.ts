import { db, UserData } from './db'
import { ServerSession, Debtor, Transfer, HttpResponse, TransfersList, HttpError } from './server'
import { calcSha256 } from '../debtor-info'
import { parseRootConfigData, InvalidRootConfigData } from '../root-config-data'

export async function getDebtorInfoDocument(server: ServerSession, configData: string): Promise<UserData['document']> {
  try {
    const rootConfigData = parseRootConfigData(configData)
    const uri = rootConfigData.info?.iri
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
  } catch (e: unknown) {
    if (e instanceof InvalidRootConfigData) { /* ignore */ }
    else if (e instanceof HttpError && e.status === 404) { /* ignore */ }
    else throw e
  }
  return undefined
}

function calcParallelTimeout(numberOfParallelRequests: number): number {
  const n = 6  // a rough guess for the maximum number of parallel connections
  return appConfig.serverApiTimeout * (numberOfParallelRequests + n - 1) / n
}

export async function getUserData(server: ServerSession, getTransfers = true): Promise<UserData> {
  const collectedAfter = new Date()

  const debtorResponse = await server.getEntrypointResponse() as HttpResponse<Debtor>
  const debtor = { ...debtorResponse.data }

  let transferUris
  let transfers
  const transfersListUri = debtorResponse.buildUri(debtor.transfersList.uri)
  let attemptsLeft = 10
  while (true) {
    const transfersListResponse = await server.get(transfersListUri) as HttpResponse<TransfersList>
    transferUris = transfersListResponse.data.items.map(item => transfersListResponse.buildUri(item.uri))
    if (getTransfers) {
      const unconcludedTransferUris = (
        await Promise.all(transferUris.map(async uri => await db.isConcludedTransfer(uri) ? undefined : uri))
      ).filter(uri => uri !== undefined) as string[]
      const timeout = calcParallelTimeout(unconcludedTransferUris.length)
      try {
        transfers = (
          await Promise.all(unconcludedTransferUris.map(uri => server.get(uri, { timeout }))) as HttpResponse<Transfer>[]
        ).map(response => ({ ...response.data, uri: response.url } as Transfer))
      } catch (e: unknown) {
        if (e instanceof HttpError && e.status === 404 && attemptsLeft--) {
          // Normally, this can happen only if a transfer has been
          // deleted after the transfer list was obtained. In this
          // case, we should obtain the transfer list again, and
          // retry.
          continue
        } else throw e
      }
    }
    break
  }

  return {
    collectedAfter,
    debtor,
    transferUris,
    transfers,
    document: await getDebtorInfoDocument(server, debtor.config.configData),
  }
}
