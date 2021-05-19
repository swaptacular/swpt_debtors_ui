import axios from 'axios'
import type { AxiosInstance, AxiosError } from 'axios'
import type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
} from './schemas.js'
import { parse, stringify } from '../json-bigint/index.js'


type DebtorConfigUpdateRequest = {
  type?: string;
  latestUpdateId: bigint;
  configData: string;
}
type Url = string
type Uuid = string


export class ServerApiError extends Error {
  status?: number

  constructor(m?: string | number) {
    let message
    let status

    if (typeof m === 'number') {
      message = `Returned ${m} HTTP status code.`
      status = m
    } else {
      message = m
    }

    super(message)
    this.name = 'ServerApiError'
    this.status = status
  }
}


export class ServerApi {
  auth?: {
    debtorId: string,
    client: AxiosInstance,
  }
  debtor?: Debtor

  constructor(public obtainAuthToken: () => string) { }

  private async authenticate() {
    const token = this.obtainAuthToken()
    const client = axios.create({
      baseURL: appConfig.serverApiBaseUrl,
      timeout: appConfig.serverApiTimeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      transformRequest: [(data) => stringify(data)],
      transformResponse: [(data) => parse(data)],
    })

    // We do not know the real ID of the debtor yet. To obtain it, we
    // make an HTTP request and extract the ID from the response.
    const debtor = await ServerApi.redirectToDebtor(client)
    const extracted = debtor.uri.match(ServerApi.debtorUrisRegex)
    if (!extracted) {
      throw new ServerApiError('invalid debtor URI')
    }
    const auth = { client, debtorId: extracted[1] }

    this.auth = auth
    return { auth, debtor }
  }

  private async makeRequest<T>(f: (client: AxiosInstance, debtorId: string) => Promise<T>): Promise<T> {
    let auth = this.auth
    if (!auth) {
      // Sometimes this method is called by the `this.getDebtor()
      // method. To optimize those cases, we use `this.debtor` to
      // temporarily save the returned debtor instance, thus avoiding
      // to make two identical requests in a row.
      ({ auth: auth, debtor: this.debtor } = await this.authenticate())
    }

    try {
      return await f(auth.client, auth.debtorId)
    } catch (e) {
      ServerApi.wrapError(e)
    } finally {
      this.debtor = undefined
    }
  }

  async getDebtor(): Promise<Debtor> {
    return await this.makeRequest(async (client, debtorId) => {
      if (this.debtor) {
        return this.debtor
      }
      const response = await client.get(`${debtorId}/`)
      return response.data
    })
  }

  async getDebtorConfig(): Promise<DebtorConfig> {
    return await this.makeRequest(async (client, debtorId) => {
      const response = await client.get(`${debtorId}/config`)
      return response.data
    })
  }

  async updateDebtorConfig(updateRequest: DebtorConfigUpdateRequest): Promise<DebtorConfig> {
    return await this.makeRequest(async (client, debtorId) => {
      const response = await client.patch(`${debtorId}/config`, updateRequest)
      return response.data
    })
  }

  async getTransfersList(): Promise<Uuid[]> {
    return await this.makeRequest(async (client, debtorId) => {
      const response = await client.get(`${debtorId}/transfers/`)
      const transfersList = response.data as TransfersList
      const transferUris = transfersList.items.map(item => item.uri)
      const uuids = transferUris.map(uri => uri.match(ServerApi.transferUrisRegex)?.[1])
      if (uuids.includes(undefined)) {
        throw new ServerApiError('invalid transfer URI')
      }
      return uuids as Uuid[]
    })
  }

  async createTransfer(creationRequest: TransferCreationRequest): Promise<Transfer | undefined> {
    return await this.makeRequest(async (client, debtorId) => {
      const response = await client.post(`${debtorId}/transfers/`, creationRequest, { maxRedirects: 0 })
      if (response.status === 303) {
        return undefined  // The same transfer entry already exists.
      }
      return response.data
    })
  }

  async getTransfer(transferUuid: Uuid): Promise<Transfer> {
    return await this.makeRequest(async (client, debtorId) => {
      const response = await client.get(`${debtorId}/transfers/${transferUuid}`)
      return response.data
    })
  }

  async cancelTransfer(transferUuid: Uuid): Promise<Transfer> {
    return await this.makeRequest(async (client, debtorId) => {
      const cancelationRequest = { "type": "TransferCancelationRequest" }
      const response = await client.post(`${debtorId}/transfers/${transferUuid}`, cancelationRequest)
      return response.data
    })
  }

  async deleteTransfer(transferUuid: Uuid): Promise<void> {
    return await this.makeRequest(async (client, debtorId) => {
      await client.delete(`${debtorId}/transfers/${transferUuid}`)
    })
  }

  async saveDocument(contentType: string, content: ArrayBuffer): Promise<Url> {
    return await this.makeRequest(async (client, debtorId) => {
      const config = {
        headers: {
          'Content-Type': contentType,
          'Accept': contentType,
        },
        transformRequest: [],
        transformResponse: [],
        responseType: 'arraybuffer' as const,
      }
      const response = await client.post(`${debtorId}/documents/`, content, config)
      return response.headers.location
    })
  }

  static debtorUrisRegex = /^(?:.*\/)?(\d+)\/$/
  static transferUrisRegex = /^(?:.*\/)?([0-9A-Fa-f-]+)$/

  static wrapError(e: Error, kw = { copyHttpStatus: true }): never {
    const error = e as AxiosError
    if (error.isAxiosError) {
      const status = kw.copyHttpStatus ? error?.response?.status : undefined
      throw new ServerApiError(status ?? error.message)
    }
    throw error
  }

  static async redirectToDebtor(client: AxiosInstance): Promise<Debtor> {
    let response
    try {
      response = await client.get(`.debtor`)
    } catch (e) {
      ServerApi.wrapError(e, { copyHttpStatus: false })
    }
    if (response.status === 204) {
      throw new ServerApiError('debtor not found')
    }
    return response.data
  }
}


export type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
  DebtorConfigUpdateRequest,
}