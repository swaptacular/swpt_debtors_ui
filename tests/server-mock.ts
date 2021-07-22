import { HttpError, HttpResponse, RequestConfig } from '../src/web-api'
import type { Debtor, Transfer } from '../src/web-api-schemas'
import type { Document } from '../src/debtor-info'

export function createServerMock(debtor: Debtor, transfers: Transfer[] = [], _document?: Document): any {
  let documentId = 0
  let document = _document ? { ..._document, uri: `${debtor.saveDocument.uri}0` } : undefined

  function create200Response(url: string, data: any, headers: any = {}): HttpResponse {
    return {
      url,
      data,
      headers,
      status: 200,
      time: new Date(),
      buildUri(uriReference: string): string {
        return new URL(uriReference, this.url).href
      },
    }
  }

  function create201Response(url: string, location: string, data: any, contentType?: 'application/json'): HttpResponse {
    return {
      url,
      data,
      status: 201,
      headers: { location, 'content-type': contentType },
      time: new Date(),
      buildUri(uriReference: string): string {
        return new URL(uriReference, this.url).href
      },
    }
  }

  function create204Response(url: string): HttpResponse {
    return {
      url,
      data: undefined,
      status: 204,
      headers: {},
      time: new Date(),
      buildUri(uriReference: string): string {
        return new URL(uriReference, this.url).href
      },
    }
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

    getEntrypointResponse: jest.fn(async (): Promise<HttpResponse> => {
      return create200Response(debtor.uri, debtor)
    }),

    get: jest.fn(async (url: string): Promise<HttpResponse> => {
      switch (url) {
        case debtor.uri:
          return create200Response(url, debtor)

        case debtor.transfersList.uri:
          return create200Response(url, {
            type: 'TransfersList',
            uri: debtor.transfersList.uri,
            first: '',
            debtor: debtor.uri,
            itemsType: 'ObjectReference',
            items: transfers.map(t => ({ uri: t.uri }))
          })

        case debtor.config.uri:
          return create200Response(url, debtor.config)

        case debtor.publicInfoDocument.uri:
        case document?.uri:
          if (document) {
            return create200Response(url, document.content, { 'content-type': document.contentType })
          }
          return createErrorResponse(url, 404)

        default:
          for (const transfer of transfers) {
            if (transfer.uri === url) return create200Response(url, transfer)
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
          return create201Response(url, uri, transfer)

        case debtor.saveDocument.uri:
          const contentType = config?.headers['content-type']
          document = {
            uri: `${debtor.saveDocument.uri}${++documentId}`,
            content: data,
            contentType,
          }
          return create201Response(url, document.uri, data, contentType)

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
            return create200Response(url, debtor.config)
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
          return create204Response(url)
        }
      }
      return createErrorResponse(url, 404)
    }),

    async getDocument(url: string): Promise<HttpResponse<ArrayBuffer>> {
      return await this.get(url) as HttpResponse<ArrayBuffer>
    },

    async postDocument(url: string, contentType: string, content: ArrayBuffer): Promise<HttpResponse> {
      const config = {
        headers: { 'Content-Type': contentType },
      }
      return await this.post(url, content, config)
    },

  }
}

