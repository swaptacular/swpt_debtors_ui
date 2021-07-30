<script lang="ts">
  import { login } from '../operations'
  import { createAppState } from '../stores'
  import Router from './Router.svelte'

  const appStatePromise = createAppState()
</script>

<main>
  {#await appStatePromise}
    <h1>Launching...</h1>
  {:then appState}
    {#if appState }
      <Router {appState}/>
    {:else}
      <button on:click={() => login()}>Login</button>
    {/if}
  {:catch error}
    <h1>{console.error(error), 'An unexpected error has occured.'}</h1>
  {/await}
</main>
