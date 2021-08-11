import { HttpError, HttpResponse, RequestConfig } from '../src/web-api'
import type { Debtor, Transfer } from '../src/web-api-schemas'
import type { Document } from '../src/debtor-info'

export function createServerMock(debtor: Debtor, transfers: Transfer[] = [], _document?: Document): any {
  let documentId = 0
  let document = _document ? { ..._document, uri: `${debtor.saveDocument.uri}0/public` } : undefined

  function createResponse(status: number, url: string, data: any = undefined, headers: any = {}): HttpResponse {
    return new HttpResponse({
      status,
      data,
      headers,
      statusText: `${status} response`,
      request: { responseURL: url },
      config: {},
    })
  }

  function createErrorResponse(url: string, status: number): never {
    throw new HttpError({
      status,
      statusText: `${status} error`,
      request: { responseURL: url },
      headers: {},
      data: undefined,
      config: {},
    })
  }

  return {
    entrypointPromise: Promise.resolve(debtor.uri),
    login: jest.fn(),
    logout: jest.fn(),

    getEntrypointResponse: jest.fn(async function(this: any): Promise<HttpResponse> {
      return await this.get(debtor.uri)
    }),

    async authenticate(): Promise<void> { },

    get: jest.fn(async (url: string): Promise<HttpResponse> => {
      switch (url) {
        case debtor.uri:
          return createResponse(200, url, debtor)

        case debtor.transfersList.uri:
          return createResponse(200, url, {
            type: 'TransfersList',
            uri: debtor.transfersList.uri,
            first: '',
            debtor: debtor.uri,
            itemsType: 'ObjectReference',
            items: transfers.map(t => ({ uri: t.uri }))
          })

        case debtor.config.uri:
          return createResponse(200, url, debtor.config)

        case debtor.publicInfoDocument.uri:
        case document?.uri:
          if (document) {
            return createResponse(200, url, document.content, { 'content-type': document.contentType })
          }
          return createErrorResponse(url, 404)

        default:
          for (const transfer of transfers) {
            if (transfer.uri === url) return createResponse(200, url, transfer)
          }
          return createErrorResponse(url, 404)
      }
    }),

    post: jest.fn(async (url: string, data?: any, config?: RequestConfig): Promise<HttpResponse> => {
      switch (url) {
        case debtor.createTransfer.uri:
          const now = Date.now()
          const uri = `${debtor.createTransfer.uri}${data.transferUuid}`
          const transfer = {
            ...data,
            uri,
            type: 'Transfer',
            checkupAt: new Date(now + 10000).toISOString(),
            transfersList: { uri: debtor.transfersList.uri },
            initiatedAt: new Date(now).toISOString(),
          }
          transfers.push(transfer)
          return createResponse(201, url, transfer, { location: uri })

        case debtor.saveDocument.uri:
          const contentType = config?.headers['content-type']
          document = {
            uri: `${debtor.saveDocument.uri}${++documentId}/public`,
            content: data,
            contentType,
          }
          return createResponse(201, url, data, { location: document.uri, 'content-type': contentType })

        default:
          for (const transfer of transfers) {
            if (transfer.uri === url) {
              return createErrorResponse(url, 403)
            }
          }
          return createErrorResponse(url, 404)
      }
    }),

    patch: jest.fn(async (url: string, data?: any): Promise<HttpResponse> => {
      switch (url) {
        case debtor.config.uri:
          const isNext = data.latestUpdateId === debtor.config.latestUpdateId + 1n
          const isSame = data.latestUpdateId === debtor.config.latestUpdateId && data.configData === debtor.config.configData
          if (isNext || isSame) {
            debtor.config.configData = data.configData
            debtor.config.latestUpdateId = data.latestUpdateId
            debtor.config.latestUpdateAt = isNext ? new Date().toISOString() : debtor.config.latestUpdateAt
            return createResponse(200, url, debtor.config)
          } else {
            return createErrorResponse(url, 409)
          }

        default:
          return createErrorResponse(url, 404)
      }
    }),

    delete: jest.fn(async (url: string): Promise<HttpResponse> => {
      for (const transfer of transfers) {
        if (transfer.uri === url) {
          transfers = transfers.filter(t => t.uri !== url)
          return createResponse(204, url)
        }
      }
      return createErrorResponse(url, 404)
    }),

    async getDocument(url: string): Promise<HttpResponse<ArrayBuffer>> {
      return await this.get(url) as HttpResponse<ArrayBuffer>
    },

    async postDocument(url: string, contentType: string, content: ArrayBuffer, config?: RequestConfig): Promise<HttpResponse> {
      config = {
        headers: { 'content-type': contentType },
      }
      return await this.post(url, content, config)
    },

  }
}

