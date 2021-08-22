<script lang="ts">
  import { login } from '../operations'
  import { createAppState } from '../app-state'
  import Router from './Router.svelte'

  let unauthenticated = false
  let authenticationError = false
  let networkError = false
  let httpError = false

  addEventListener('update-authentication-error', (event) => {
    unauthenticated = true
    if (!authenticationError) {
      authenticationError = true
      setTimeout(() => { authenticationError = false}, 60000)
    }
    event.preventDefault()
  })
  addEventListener('update-network-error', (event) => {
    if (!networkError) {
      networkError = true
      setTimeout(() => { networkError = false}, 60000)
    }
    event.preventDefault()
  })
  addEventListener('update-http-error', (event) => {
    if (!httpError) {
      httpError = true
      setTimeout(() => { httpError = false}, 60000)
    }
    event.preventDefault()
  })

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }
  const appStatePromise = createAppState()
</script>

{#await appStatePromise}
  <h1>Launching...</h1>
{:then appState}
  {#if appState === undefined }
    <button on:click={() => login()}>Login</button>
  {:else}
    <Router app={appState} {unauthenticated} {authenticationError} {networkError} {httpError} />
  {/if}
{:catch error}
  <h1>{logError(error)}</h1>
{/await}
