import { oauth2TokenSource } from './oauth2/index.js'
import App from './App.svelte'

oauth2TokenSource.init()

const app = new App({
  target: document.body,
  props: {
    name: 'world'
  }
})

export default app
