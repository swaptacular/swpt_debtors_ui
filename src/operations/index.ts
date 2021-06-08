import type { Debtor, Transfer, TransfersList } from '../web-api-schemas.js'
import { ServerSession, HttpResponse } from '../web-api/index.js'

const session = new ServerSession({
  onLoginAttempt: async (login) => {
    if (confirm('This operation requires authentication. You will be redirected to the login page.')) {
      return await login()
    }
    return false
  }
})


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


function extractInfoIri(configData: string): string | undefined {
  const data = JSON.parse(configData) as ConfigData
  return data?.info?.iri
}


type CompleteUserData = {
  debtorUri: string,
  debtor: Debtor,
  transfers: {
    uri: string,
    transfer: Transfer,
  }[],
  document?: {
    uri: string,
    contentType: string,
    content: ArrayBuffer,
  }
}


async function pullData(): Promise<CompleteUserData> {
  const {
    url: debtorUri,
    data: debtor,
  } = await session.getEntrypointResponse() as HttpResponse<Debtor>

  const {
    url: transfersListUrl,
    data: transfersList,
  } = await session.get(debtor.transfersList.uri, { baseURL: debtorUri }) as HttpResponse<TransfersList>

  const transfers = (
    await Promise.all(transfersList
      .items
      .map(item => item.uri)
      .map(uri => session.get(uri, { baseURL: transfersListUrl }))
    ) as HttpResponse<Transfer>[]
  ).map(response => ({ uri: response.url, transfer: response.data }))

  const pullInfoDocument = async () => {
    const uri = extractInfoIri(debtor.config.configData)
    if (uri !== undefined) {
      const { headers, data } = await session.getDocument(uri)
      return { uri, contentType: String(headers['content-type']), content: data }
    }
    return undefined
  }

  return {
    debtorUri,
    debtor,
    transfers,
    document: await pullInfoDocument(),
  }
}
