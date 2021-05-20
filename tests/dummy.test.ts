import App from '../src/App.svelte'
import { stringify, parse } from '../src/json-bigint/index.js'
import { ServerApi, ErrorResponse } from '../src/server-api/index.js'

const authToken = Promise.resolve('3x-KAxNWrYPJUWNKTbpnTWxoR0Arr0gG_uEqeWUNDkk.B-Iqy02FM7rK1rKSb4I7D9gaqGFXc2vdyJQ6Uuv3EF4')

test("Instantiate svelte app", () => {
  const el = document.body
  const app = new App({
    target: el,
    props: { name: 'world' },
  })
  expect(el).toBeInstanceOf(HTMLElement)
  expect(app).toBeTruthy()
})

test("Stringify non-ASCII", () => {
  const s = stringify("Кирилица")
  expect(s).toBe('"Кирилица"')
})

test("Stringify bigint", () => {
  const s = stringify({ float: 1, int: 1n, bigint: 123456789012345678901234567890n })
  expect(s).toBe('{\"float":1,"int":1,"bigint":123456789012345678901234567890}')
})

test("Parse bigint", () => {
  const o = parse('{\"float":1.0,"int":1,"bigint":123456789012345678901234567890}')
  expect(o).toEqual({ float: 1, int: 1n, bigint: 123456789012345678901234567890n })
})

test("Create ServerApi", async () => {
  const api = new ServerApi(() => authToken)
  expect(api).toBeInstanceOf(ServerApi)
})

test.skip("Request debtor info", async () => {
  const api = new ServerApi(() => authToken)
  api.getDebtor().then(data => {
    expect(data).toHaveProperty('identity')
  })
})

test.skip("Try to cancel non-existing transfer", async () => {
  const api = new ServerApi(() => authToken)
  api.cancelTransfer('123e4567-e89b-12d3-a456-426655440000').catch(e => {
    expect(e).toBeInstanceOf(ErrorResponse)
    expect(e.status).toBe(404)
  })
})

test.skip("Try to save document", async () => {
  const api = new ServerApi(() => authToken)
  const buffer = new ArrayBuffer(4)
  const view = new Int32Array(buffer);
  view[0] = 0
  api.saveDocument('application/octet-stream', buffer).then(url => {
    expect(url.length > 0).toBeTruthy()
  })
})
