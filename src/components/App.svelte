<script lang="ts">
  import { login, ServerSessionError } from '../operations'
  import { createAppState } from '../app-state'
  import Router from './Router.svelte'

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }
  const appStatePromise = createAppState()
</script>

<main>
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
