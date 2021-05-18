import App from '../src/App.svelte'
import { stringify, parse } from '../src/json-bigint/index.js'
import { ServerApi, ServerApiError } from '../src/server-api/index.js'

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
  const api = new ServerApi(() => '')
  expect(api).toBeInstanceOf(ServerApi)
})

test.skip("Request debtor info", async () => {
  const api = new ServerApi(() => 'INVALID')
  api.getDebtor().catch(e => {
    expect(e).toBeInstanceOf(ServerApiError)
    expect(e.status).toBe(401)
  })
})
