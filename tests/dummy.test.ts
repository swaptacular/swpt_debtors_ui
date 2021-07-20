import App from '../src/App.svelte'

test("Instantiate svelte app", () => {
  const el = document.body
  const app = new App({
    target: el,
    props: { name: 'world' },
  })
  expect(el).toBeInstanceOf(HTMLElement)
  expect(app).toBeTruthy()
})
