import { handleOauth2Redirect } from './oauth2'
import App from './App.svelte'

handleOauth2Redirect().catch(e => {
  console.error(e)
  alert('An unexpected authentication error has occurred.')
})

const app = new App({
  target: document.body,
  props: {
    name: 'world'
  }
})

export default app
