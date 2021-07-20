import { ServerSession, HttpError } from '../src/web-api'
import type { AuthTokenSource } from '../src/web-api/oauth2-token-source'

const authToken = '3x-KAxNWrYPJUWNKTbpnTWxoR0Arr0gG_uEqeWUNDkk.B-Iqy02FM7rK1rKSb4I7D9gaqGFXc2vdyJQ6Uuv3EF4'

class SingleToken implements AuthTokenSource {
  token?: string

  constructor(token: string) {
    this.token = token
  }

  getToken() {
    if (this.token === undefined) {
      throw Error('Can not obtain token.')
    }
    return Promise.resolve(this.token)
  }

  invalidateToken(token: string) {
    if (token === this.token) {
      this.token = undefined
    }
  }

  logout() { }
}

test.skip("Create ServerSession", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  expect(session).toBeInstanceOf(ServerSession)
})

test.skip("Get debtor URL", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  expect(debtorUrl).toContain('/debtors/')
})

test.skip("Request debtor info", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  const response = await session.get(debtorUrl as string)
  expect(response.status).toBe(200)
  expect(response.data).toHaveProperty('identity')
})

test.skip("Try to cancel non-existing transfer", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  try {
    await session.post(`${debtorUrl}transfers/123e4567-e89b-12d3-a456-426655440000`)
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError)
    expect(e.status).toBe(404)
    expect(e.url).toContain('123e4567-e89b-12d3-a456-426655440000')
  }
})

test.skip("Try to save document", async () => {
  const session = new ServerSession({ tokenSource: new SingleToken(authToken) })
  const debtorUrl = await session.entrypointPromise
  const buffer = new ArrayBuffer(4)
  const view = new Int32Array(buffer);
  view[0] = 0
  const response = await session.postDocument(`${debtorUrl}documents/`, 'application/octet-stream', buffer)
  expect(response.url.length > 0).toBeTruthy()
  expect(response.headers['content-type']).toBe('application/octet-stream')
  expect(typeof response.data).toBe('object')  // ArrayBuffer or Buffer
})
