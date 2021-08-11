<script lang="ts">
  import { login, ServerSessionError } from '../operations'
  import { createAppState } from '../app-state'
  import Router from './Router.svelte'

  let authenticationError = false
  let networkError = false

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }
  addEventListener('update-authentication-error', (event) => {
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
  const appStatePromise = createAppState()
</script>

<main>
  {#if authenticationError }
    <h1>An authentication error has occured.</h1>
  {/if}
  {#if networkError }
    <h1>A network error has occured.</h1>
  {/if}

  {#await appStatePromise}
    <h1>Launching...</h1>
  {:then appState}
    {#if appState === undefined }
      <button on:click={() => login()}>Login</button>
    {:else}
      <Router app={appState}/>
    {/if}
  {:catch error}
    {#if error instanceof ServerSessionError }
      <h1>Network error</h1>
    {:else}
      <h1>{logError(error)}</h1>
    {/if}
  {/await}
</main>
