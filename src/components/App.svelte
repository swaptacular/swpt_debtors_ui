<script lang="ts">
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'
  import { login } from '../operations'
  import { createAppState } from '../app-state'
  import Router from './Router.svelte'

  const unauthenticated = writable(false)
  const authenticationError = writable(false)
  const networkError = writable(false)
  const httpError = writable(false)

  setContext('unauthenticated', unauthenticated)
  setContext('authenticationError', authenticationError)
  setContext('networkError', networkError)
  setContext('httpError', httpError)

  addEventListener('update-authentication-error', (event) => {
    unauthenticated.set(true)
    if (!$authenticationError) {
      authenticationError.set(true)
      setTimeout(() => { authenticationError.set(false) }, 600_000)
    }
    event.preventDefault()
  })
  addEventListener('update-network-error', (event) => {
    if (!$networkError) {
      networkError.set(true)
      setTimeout(() => { networkError.set(false) }, 600_000)
    }
    event.preventDefault()
  })
  addEventListener('update-http-error', (event) => {
    if (!$httpError) {
      httpError.set(true)
      setTimeout(() => { httpError.set(false) }, 600_000)
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
    <Router app={appState} />
  {/if}
{:catch error}
  <h1>{logError(error)}</h1>
{/await}
