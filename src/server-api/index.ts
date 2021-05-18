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


function wrapErrorResponses(e: Error): never {
  const error = e as AxiosError
  if (error.isAxiosError && error.response) {
    throw new ServerApiError(error.response.status)
  }
  throw error
}


export class ServerApi {
  auth?: {
    debtorId: bigint,
    client: AxiosInstance,
  }

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
    this.auth = { client, debtorId: 0n }

    // We do not know the real ID of the debtor yet. To obtain it, we
    // make an HTTP request and extract the ID from the response.
    const debtor = await this.redirectToDebtor()
    const captured = debtor.uri.match(/^(?:.*\/)?(\d+)\/$/)
    if (!captured) {
      throw new ServerApiError('Invalid debtor URI.')
    }
    this.auth.debtorId = BigInt(captured[1])

    return this.auth
  }

  private async makeRequest<T>(f: (client: AxiosInstance, debtorId: bigint) => Promise<T>): Promise<T> {
    let auth = this.auth || await this.authenticate()

    try {
      return await f(auth.client, auth.debtorId)
    } catch (e) {
      wrapErrorResponses(e)
    }
  }

  async redirectToDebtor(): Promise<Debtor> {
    return await this.makeRequest(async (client): Promise<Debtor> => {
      const response = await client.get(`.debtor`)
      if (response.status === 204) {
        throw new ServerApiError('The debtor has not been found.')
      }
      return response.data
    })
  }

  async getDebtor(): Promise<Debtor> {
    return await this.makeRequest(async (client, debtorId): Promise<Debtor> => {
      const response = await client.get(`${debtorId}/`)
      return response.data
    })
  }

  async getDebtorConfig(): Promise<DebtorConfig> {
    return await this.makeRequest(async (client, debtorId): Promise<DebtorConfig> => {
      const response = await client.get(`${debtorId}/config`)
      return response.data
    })
  }

  async updateDebtorConfig(updateRequest: DebtorConfigUpdateRequest): Promise<DebtorConfig> {
    return await this.makeRequest(async (client, debtorId): Promise<DebtorConfig> => {
      const response = await client.patch(`${debtorId}/config`, updateRequest)
      return response.data
    })
  }

  async getTransfersList(): Promise<TransfersList> {
    return await this.makeRequest(async (client, debtorId): Promise<TransfersList> => {
      const response = await client.get(`${debtorId}/transfers/`)
      return response.data
    })
  }

  async createTransfer(creationRequest: TransferCreationRequest): Promise<Transfer | undefined> {
    return await this.makeRequest(async (client, debtorId): Promise<Transfer | undefined> => {
      const response = await client.post(
        `${debtorId}/transfers/`,
        creationRequest,
        { maxRedirects: 0 },
      )
      if (response.status === 303) {
        return undefined  // The same transfer entry already exists.
      }
      return response.data
    })
  }

  async getTransfer(transferUuid: Uuid): Promise<Transfer> {
    return await this.makeRequest(async (client, debtorId): Promise<Transfer> => {
      const response = await client.get(`${debtorId}/transfers/${transferUuid}`)
      return response.data
    })
  }

  async cancelTransfer(transferUuid: Uuid): Promise<Transfer> {
    return await this.makeRequest(async (client, debtorId): Promise<Transfer> => {
      const cancelationRequest = { "type": "TransferCancelationRequest" }
      const response = await client.post(`${debtorId}/transfers/${transferUuid}`, cancelationRequest)
      return response.data
    })
  }

  async deleteTransfer(transferUuid: Uuid): Promise<void> {
    return await this.makeRequest(async (client, debtorId): Promise<void> => {
      await client.delete(`${debtorId}/transfers/${transferUuid}`)
    })
  }

  async saveDocument(contentType: string, content: string): Promise<Url> {
    return await this.makeRequest(async (client, debtorId): Promise<Url> => {
      const headers = {
        'Content-Type': contentType,
        'Accept': contentType,
      }
      const response = await client.post(`${debtorId}/documents/`, content, { headers })
      return response.headers.Location
    })
  }
}


export type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
  DebtorConfigUpdateRequest,
}
