import App from '../src/components/App.svelte'

test.skip("Instantiate svelte app", () => {
  const el = document.body
  const app = new App({
    target: el,
    props: { name: 'world' },
  })
  expect(el).toBeInstanceOf(HTMLElement)
  expect(app).toBeTruthy()
})
