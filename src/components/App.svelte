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
      setTimeout(() => { authenticationError = false}, 5000)
    }
    event.preventDefault()
  })
  addEventListener('update-network-error', (event) => {
    if (!networkError) {
      networkError = true
      setTimeout(() => { networkError = false}, 5000)
    }
    event.preventDefault()
  })
  addEventListener('update-http-error', (event) => {
    if (!httpError) {
      httpError = true
      setTimeout(() => { httpError = false}, 5000)
    }
    event.preventDefault()
  })

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }
  const appStatePromise = createAppState()
</script>

<main>
  {#if authenticationError }
    <h1>An authentication error has occured.</h1>
  {/if}
  {#if networkError }
    <h1>A network error has occured.</h1>
  {/if}
  {#if httpError }
    <h1>A server error has occured.</h1>
  {/if}

  {#await appStatePromise}
    <h1>Launching...</h1>
  {:then appState}
    {#if appState === undefined }
      <button on:click={() => login()}>Login</button>
    {:else}
      <Router app={appState} {unauthenticated} />
    {/if}
  {:catch error}
    <h1>{logError(error)}</h1>
  {/await}
</main>
