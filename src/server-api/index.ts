import axios from 'axios'
import type { AxiosInstance, AxiosError, AxiosResponse } from 'axios'
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
  name = 'ServerApiError'
}


export class ErrorResponse extends Error {
  name = 'ErrorResponse'
  status: number
  headers: any
  data: any

  constructor(r: AxiosResponse) {
    super(`status code ${r.status}`)
    this.status = r.status
    this.headers = r.headers
    this.data = r.data
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
      transformRequest: (data) => stringify(data),
      transformResponse: (data, headers) => {
        if (typeof data == 'string' && headers['content-type'] === 'application/json') {
          return parse(data)
        }
        return data
      },
    })

    // We do not know the ID of the debtor yet. To obtain it, we make
    // an HTTP request and extract the ID from the response.
    const debtor = await ServerApi.redirectToDebtor(client)
    const debtorId = debtor.uri.match(ServerApi.debtorUrisRegex)?.[1]
    if (debtorId === undefined) {
      throw new TypeError('undefined instead of string')  // Normally, this should never happen
    }
    const auth = { client, debtorId }

    this.auth = auth
    return { auth, debtor }
  }

  private async makeRequest<T>(f: (client: AxiosInstance, debtorId: string) => Promise<T>): Promise<T> {
    let auth = this.auth
    if (!auth) {
      // Sometimes this method is called by the `this.getDebtor()
      // method. To optimize these cases, we use `this.debtor` to
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
        throw new TypeError('undefined instead of string')  // Normally, this should never happen
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
        responseType: 'arraybuffer' as const,
      }
      const response = await client.post(`${debtorId}/documents/`, content, config)
      return response.headers.location
    })
  }

  static debtorUrisRegex = /^(?:.*\/)?([0-9A-Za-z_=-]+)\/$/
  static transferUrisRegex = /^(?:.*\/)?([0-9A-Fa-f-]+)$/

  static wrapError(e: Error, kw = { passResponse: true }): never {
    const error = e as AxiosError
    if (error.isAxiosError) {
      const response = error.response
      if (response && kw.passResponse) {
        throw new ErrorResponse(response)
      }
      throw new ServerApiError(error.message)
    }
    throw error
  }

  static async redirectToDebtor(client: AxiosInstance): Promise<Debtor> {
    let response
    try {
      response = await client.get(`.debtor`)
    } catch (e) {
      // The eventual Axios error response (`e.response`) should not
      // be passed to the caller, because this function is always
      // executed implicitly, as a part of the authentication process.
      ServerApi.wrapError(e, { passResponse: false })
    }
    if (response.status === 204) {
      throw new Error('debtor not found')  // Normally, this should never happen.
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
