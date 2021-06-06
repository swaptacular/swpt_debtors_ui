import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios'
import type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
  TransferCancelationRequest,
  DebtorConfigUpdateRequest,
} from './schemas.js'
import { parse, stringify } from '../json-bigint/index.js'


export type {
  ObjectReference,
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
  TransferCancelationRequest,
  DebtorConfigUpdateRequest,
}

export type GetTokenOptions = {
  attemptLogin?: boolean,
}

export type RequestConfig =
  & AxiosRequestConfig
  & GetTokenOptions

export type AuthTokenSource = {
  getToken: (options?: GetTokenOptions) => string | Promise<string>,
  invalidateToken: (token: string) => void | Promise<void>,
  logout: () => void | Promise<void>
}

type UserData = {
  debtorUrl: string,
  tokenHash: string,
}

const LOCALSTORAGE_KEY = 'server-api-user'


function buffer2hex(buffer: ArrayBuffer, options = { toUpperCase: true }) {
  const bytes = [...new Uint8Array(buffer)]
  const hex = bytes.map(n => n.toString(16).padStart(2, '0')).join('')
  return options.toUpperCase ? hex.toUpperCase() : hex
}


async function calcSha256(buffer: string | ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof buffer === 'string') {
    buffer = new TextEncoder().encode(buffer)
  }
  return await crypto.subtle.digest('SHA-256', buffer)
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
  data: unknown

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


export class AuthenticationError extends ServerSessionError {
  name = 'AuthenticationError'
}


export class ServerSession {
  readonly debtorUrlPromise: Promise<string | undefined>

  private tokenSource: AuthTokenSource
  private authData?: {
    client: AxiosInstance,
    token: string,
  }

  constructor(s: AuthTokenSource) {
    this.tokenSource = s
    this.debtorUrlPromise = this.obtainDebtorUrl()
  }

  async login(): Promise<void> {
    const debtorUrl = await this.debtorUrlPromise
    if (!debtorUrl) {
      await this.authenticate({ attemptLogin: true })
      await ServerSession.redirectHome()
    }
  }

  async logout(): Promise<void> {
    await this.tokenSource.logout()
    ServerSession.saveUserData(undefined)
    await ServerSession.redirectHome()
  }

  async get(url: string, config?: RequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.get(url, config)),
      config,
    )
  }

  async post(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.post(url, data, config)),
      config,
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
      attemptLogin: true,
    }
    return await this.post(url, content, config)
  }

  async patch(url: string, data?: any, config?: RequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.patch(url, data, config)),
      config,
    )
  }

  async delete(url: string, config?: RequestConfig): Promise<HttpResponse> {
    return await this.makeRequest(
      async client => new HttpResponse(await client.delete(url, config)),
      config,
    )
  }

  private async authenticate(options?: GetTokenOptions) {
    const token = await this.tokenSource.getToken(options)
    const tokenHash = buffer2hex(await calcSha256(token))
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

    // We still do not know the URL of the debtor that corresponds to
    // the new token. We try to obtain it from the saved user data
    // first. If this fails, we make a "redirectToDebtor" HTTP
    // request, and get the debtor URL from the redirect location.
    let debtorUrl
    const userData = ServerSession.loadUserData()
    if (tokenHash === userData?.tokenHash) {
      debtorUrl = userData.debtorUrl
    } else {
      debtorUrl = await ServerSession.makeRedirectToDebtorRequest(client)
      ServerSession.saveUserData({ debtorUrl, tokenHash })
    }

    const authData = { client, token }
    this.authData = authData
    return { authData, debtorUrl }
  }

  private async makeRequest<T>(
    reqfunc: (client: AxiosInstance) => Promise<T>,
    options?: GetTokenOptions,
    retryOn401: boolean = true,
  ): Promise<T> {
    const authData = this.authData ?? (await this.authenticate(options)).authData

    try {
      return await reqfunc(authData.client)

    } catch (e: unknown) {
      const error = ServerSession.convertError(e)

      // If the request failed with status 401, the authentication
      // token is invalidated, and the request is retried (only once).
      if (error instanceof HttpError && error.status === 401) {
        await this.tokenSource.invalidateToken(authData.token)
        this.authData = undefined

        if (retryOn401) {
          return await this.makeRequest(reqfunc, options, false)
        }
      }

      throw error
    }
  }

  private async obtainDebtorUrl(): Promise<string | undefined> {
    let debtorUrl
    try {
      debtorUrl = (await this.authenticate({ attemptLogin: false })).debtorUrl
    } catch (e: unknown) {
      if (e instanceof AuthenticationError) {
        debtorUrl = ServerSession.loadUserData()?.debtorUrl
      } else {
        throw e
      }
    }

    // Note that before we tell the user that he/she is not logged in
    // (`debtorUrl === undefined`), we must ensure that there are no
    // authorization tokens remaining in in the browser local storage.
    if (debtorUrl === undefined) {
      await this.tokenSource.logout()
    }
    return debtorUrl
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

  private static async makeRedirectToDebtorRequest(client: AxiosInstance): Promise<string> {
    // Normally, when the debtor is found, the response will have
    // status code 303 (a redirect). Here we try to not follow the
    // redirect, thus sparing one unnecessary request. Unfortunately,
    // the "maxRedirects" option in Axios works only in Node, and
    // therefore we have to be prepared to handle both 303 and 200
    // status codes.

    let response
    try {
      response = await client.get(`.debtor`, { maxRedirects: 0 })

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
        if (error.status == 401) {
          throw new AuthenticationError('invalid token')
        }

        // This function should never throw an `HttpError` to the
        // caller, because it is always executed implicitly, as a part
        // of the authentication process.
        throw new AuthenticationError(error.message)
      }

      throw error
    }

    if (response.status !== 200) {
      throw new AuthenticationError('debtor not found')
    }
    return getRequestUrl(response)
  }

  private static redirectHome(): Promise<never> {
    location.replace(appConfig.oauth2.redirectUrl)
    return new Promise(() => { })
  }

  private static loadUserData(): UserData | undefined {
    let userData
    const s = localStorage.getItem(LOCALSTORAGE_KEY)
    if (s) {
      try {
        const obj = JSON.parse(s)
        userData = {
          debtorUrl: String(obj.debtorUrl),
          tokenHash: String(obj.tokenHash),
        }
      } catch {
        localStorage.removeItem(LOCALSTORAGE_KEY)
      }
    }
    return userData
  }

  private static saveUserData(userData?: UserData): void {
    if (userData) {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(LOCALSTORAGE_KEY)
    }
  }

}
