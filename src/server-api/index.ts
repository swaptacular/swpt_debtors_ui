import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type {
  Debtor,
  DebtorConfig,
  Transfer,
  TransfersList,
  TransferCreationRequest,
} from './schemas.js'


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


export class ServerApi {
  debtorId: bigint
  oauth2Token: string
  client: AxiosInstance

  constructor() {
    const oauth2Token = 'INVALID'
    this.oauth2Token = oauth2Token
    this.client = axios.create({
      baseURL: appConfig.serverApiBaseUrl,
      timeout: appConfig.serverApiTimeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauth2Token}`,
      },
    })
    this.debtorId = 1n
  }

  async redirectToDebtor(): Promise<Debtor> {
    const response = await this.client.post(`.debtor`)
    if (response.status === 204) {
      throw new ServerApiError('The debtor has not been found.')
    }
    return response.data
  }

  async getDebtor(): Promise<Debtor> {
    const response = await this.client.get(`${this.debtorId}/`)
    return response.data
  }

  async getDebtorConfig(): Promise<DebtorConfig> {
    const response = await this.client.get(`${this.debtorId}/config`)
    return response.data
  }

  async updateDebtorConfig(updateRequest: DebtorConfigUpdateRequest): Promise<DebtorConfig> {
    const response = await this.client.patch(`${this.debtorId}/config`, updateRequest)
    return response.data
  }

  async getTransfersList(): Promise<TransfersList> {
    const response = await this.client.get(`${this.debtorId}/transfers/`)
    return response.data
  }

  async createTransfer(creationRequest: TransferCreationRequest): Promise<Transfer | undefined> {
    const response = await this.client.post(
      `${this.debtorId}/transfers/`,
      creationRequest,
      { maxRedirects: 0 },
    )
    if (response.status === 303) {
      return undefined  // The same transfer entry already exists.
    }
    return response.data
  }

  async getTransfer(transferUuid: Uuid): Promise<Transfer> {
    const response = await this.client.get(`${this.debtorId}/transfers/${transferUuid}`)
    return response.data
  }

  async cancelTransfer(transferUuid: Uuid): Promise<Transfer> {
    const cancelationRequest = { "type": "TransferCancelationRequest" }
    const response = await this.client.post(`${this.debtorId}/transfers/${transferUuid}`, cancelationRequest)
    return response.data
  }

  async deleteTransfer(transferUuid: Uuid): Promise<void> {
    await this.client.delete(`${this.debtorId}/transfers/${transferUuid}`)
  }

  async saveDocument(contentType: string, content: string): Promise<Url> {
    const headers = {
      'Content-Type': contentType,
    }
    const response = await this.client.post(
      `${this.debtorId}/documents/`,
      content,
      { headers },
    )
    return response.headers.Location
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
