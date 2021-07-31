<script lang="ts">
  import { login } from '../operations'
  import { createAppState } from '../app-state'
  import Router from './Router.svelte'

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }
</script>

<main>
  {#await createAppState()}
    <h1>Launching...</h1>
  {:then appState}
    {#if appState === undefined }
      <button on:click={() => login()}>Login</button>
    {:else}
      <Router {appState}/>
    {/if}
  {:catch error}
    <h1>{logError(error)}</h1>
  {/await}
</main>
