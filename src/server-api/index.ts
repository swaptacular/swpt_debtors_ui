import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios'
import type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
  TransferCancelationRequest,
} from './schemas.js'
import { parse, stringify } from '../json-bigint/index.js'


export type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
  TransferCancelationRequest,
}

export type DebtorConfigUpdateRequest = {
  type?: string,
  latestUpdateId: bigint,
  configData: string,
}

export type AuthTokenSource = {
  getToken: () => string | Promise<string>,
  invalidateToken: (token: string) => void | Promise<void>,
}


function getRequestUrl(r: AxiosResponse): string {
  let url = r.request.responseURL
  if (url === undefined) {
    url = r.request.res.responseUrl  // running in Node.js
  }
  return url
}

export class HttpResponse {
  url: string
  status: number
  headers: any
  data: unknown

  constructor(r: AxiosResponse) {
    this.url = getRequestUrl(r)
    this.status = r.status
    this.headers = r.headers
    this.data = r.data
  }
}


export class HttpError extends Error implements HttpResponse {
  name = 'HttpError'
  url: string
  status: number
  headers: any
  data: any

  constructor(r: AxiosResponse) {
    super(`Request failed with status code ${r.status}`)
    this.url = getRequestUrl(r)
    this.status = r.status
    this.headers = r.headers
    this.data = r.data
  }
}


export class ServerSessionError extends Error {
  name = 'ServerSessionError'
}


export class ServerSession {
  private tokenSource: AuthTokenSource
  private debtorUrl?: string
  private authData?: {
    client: AxiosInstance,
    token: string,
  }

  constructor(s: AuthTokenSource) {
    this.tokenSource = s
  }

  async getDebtorUrl(): Promise<string> {
    let url = this.debtorUrl
    if (url === undefined) {
      url = (await this.authenticate()).debtorUrl
    }
    return url
  }

  async get(url: string, config?: AxiosRequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.get(url, config))
    )
  }

  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.post(url, data, config))
    )
  }

  async postDocument(url: string, contentType: string, content: ArrayBuffer): Promise<HttpResponse> {
    const config = {
      headers: {
        'Content-Type': contentType,
        'Accept': contentType,
      },
      transformRequest: [],
      responseType: 'arraybuffer' as const,
    }

    return await this.post(url, content, config)
  }

  async patch(url: string, data?: any, config?: AxiosRequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.patch(url, data, config))
    )
  }

  async delete(url: string, config?: AxiosRequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.delete(url, config))
    )
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

    // We do not know the URL of the debtor yet. To obtain it, we make
    // a "redirectToDebtor" HTTP request, and get the debtor URL from
    // the redirect location. Note that while the authentication token
    // may change during the lifespan of the `ServerSession` instance,
    // the debtor URL must stay the same.
    const debtorUrl = await ServerSession.getDebtorUrl(client)
    if (this.debtorUrl !== undefined && this.debtorUrl !== debtorUrl) {
      throw new Error("unexpected debtor URL change")
    }

    const authData = { client, token }
    this.authData = authData
    this.debtorUrl = debtorUrl
    return { authData, debtorUrl }
  }

  private async makeRequest<T>(reqfunc: (client: AxiosInstance) => Promise<T>): Promise<T> {
    const authData = this.authData ?? (await this.authenticate()).authData

    try {
      return await reqfunc(authData.client)

    } catch (e: unknown) {
      const error = ServerSession.convertError(e)

      // If the request failed with status 401, the authentication
      // token is invalidated, and the request is retried. This should
      // not result in an infinite loop, because immediately after a
      // new token is obtained, a "redirectToDebtor" request is made,
      // verifying the token.
      if (error instanceof HttpError && error.status === 401) {
        await this.tokenSource.invalidateToken(authData.token)
        this.authData = undefined
        return await this.makeRequest(reqfunc)
      }

      throw error

    }
  }

  private static convertError(e: unknown): unknown {
    if (typeof e === 'object' && e !== null) {
      const error = e as AxiosError
      if (error.isAxiosError) {
        const response = error.response
        if (response) {
          return new HttpError(response)
        }
        return new ServerSessionError(error.message)
      }
    }

    return e
  }

  private static async getDebtorUrl(client: AxiosInstance): Promise<string> {
    try {
      // Normally, the debtor will be found, and the next expression
      // will throw an `AxiosError` with status code 303 (a redirect).
      await client.get(`.debtor`, { maxRedirects: 0 })

    } catch (e: unknown) {
      const error = ServerSession.convertError(e)
      if (error instanceof HttpError) {
        if (error.status == 303) {
          const url = error.headers.location
          if (typeof url !== 'string') {
            throw new Error('missing redirect location')
          }
          return url
        }

        // This function should never throw an `HttpError` to the
        // caller, because it is always executed implicitly, as a part
        // of the authentication process.
        throw new ServerSessionError(error.message)
      }

      throw error
    }

    throw new Error('debtor not found')  // status code 204
  }
}
