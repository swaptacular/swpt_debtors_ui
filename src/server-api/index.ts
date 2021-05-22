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


export type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransferCreationRequest,
}

export type DebtorConfigUpdateRequest = {
  type?: string;
  latestUpdateId: bigint;
  configData: string;
}

export type AuthTokenSource = {
  getToken: () => string | Promise<string>,
  invalidateToken: (token: string) => void | Promise<void>,
}

export type Url = string

export type Uuid = string


export class ServerSessionError extends Error {
  name = 'ServerSessionError'
}


export class ErrorResponse extends Error {
  name = 'ErrorResponse'
  status: number
  headers: any
  data: any

  constructor(r: AxiosResponse) {
    super(`Request failed with status code ${r.status}`)
    this.status = r.status
    this.headers = r.headers
    this.data = r.data
  }
}


export class ServerSession {
  debtor!: Debtor
  debtorId!: string

  private isDebtorCurrent: boolean
  private tokenSource: AuthTokenSource
  private auth?: {
    client: AxiosInstance,
    token: string,
  }

  constructor(s: AuthTokenSource) {
    this.tokenSource = s
    this.isDebtorCurrent = false
    this.getDebtor()
  }

  async getDebtor(): Promise<Debtor> {
    return await this.makeRequest(async (client, debtorId) => {
      if (this.isDebtorCurrent) {
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
      const uuids = transferUris.map(uri => uri.match(ServerSession.transferUrisRegex)?.[1])
      if (uuids.includes(undefined)) {
        throw new Error('invalid transfer URI')
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

  private async authenticate() {
    let token
    try {
      token = await this.tokenSource.getToken()
    } catch {
      throw new ServerSessionError('Can not obtain an authentication token.')
    }

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
        if (typeof data === 'string' && headers['content-type'] === 'application/json') {
          return parse(data)
        }
        return data
      },
    })

    // We do not know the ID of the debtor yet. To obtain it, we make
    // an HTTP request, and extract the debtor ID from the
    // response. Note that while the authentication token may change
    // during the lifespan of the `ServerSession` instance, the debtor
    // ID must stay the same.
    const debtor = await ServerSession.redirectToDebtor(client)
    const debtorId = debtor.uri.match(ServerSession.debtorUrisRegex)?.[1]
    if (debtorId === undefined) {
      throw new Error('invalid debtor URI')
    }
    if (this.debtorId !== undefined && this.debtorId !== debtorId) {
      throw new Error("unexpected debtor ID change")
    }

    const auth = { client, debtorId, token }
    this.auth = auth
    this.debtor = debtor
    this.debtorId = debtorId
    return auth
  }

  private async makeRequest<T>(reqfunc: (client: AxiosInstance, debtorId: string) => Promise<T>): Promise<T> {
    let auth = this.auth
    if (!auth) {
      auth = await this.authenticate()

      // Often this method is called by the `this.getDebtor`
      // method. To optimize these cases, we temporarily set
      // `this.isDebtorCurrent` to `true`, knowing that every
      // authentication updates the value of `this.debtor`.
      this.isDebtorCurrent = true
    }

    try {
      return await reqfunc(auth.client, this.debtorId)

    } catch (e: unknown) {
      const error = ServerSession.convertError(e)

      // If the request failed with status 401, the authentication
      // token is invalidated, and the request is retried. This should
      // not result in an infinite loop because immediately after a
      // new token is obtained, a "redirectToDebtor" request is made,
      // verifying the token.
      if (error instanceof ErrorResponse && error.status === 401) {
        await this.tokenSource.invalidateToken(auth.token)
        this.auth = undefined
        return await this.makeRequest(reqfunc)
      }

      throw error

    } finally {
      this.isDebtorCurrent = false
    }
  }

  private static convertError(e: unknown, kw = { passResponse: true }): unknown {
    if (typeof e === 'object' && e !== null) {
      const error = e as AxiosError
      if (error.isAxiosError) {
        const response = error.response
        if (response && kw.passResponse) {
          return new ErrorResponse(response)
        }
        return new ServerSessionError(error.message)
      }
    }

    return e
  }

  private static async redirectToDebtor(client: AxiosInstance): Promise<Debtor> {
    let response
    try {
      response = await client.get(`.debtor`)
    } catch (e: unknown) {
      // The eventual Axios error response (`e.response`) should not
      // be passed to the caller, because this function is always
      // executed implicitly, as a part of the authentication process.
      throw ServerSession.convertError(e, { passResponse: false })
    }
    if (response.status === 204) {
      throw new Error('debtor not found')
    }
    return response.data
  }

  private static debtorUrisRegex = /^(?:.*\/)?([0-9A-Za-z_=-]+)\/$/
  private static transferUrisRegex = /^(?:.*\/)?([0-9A-Fa-f-]+)$/
}
