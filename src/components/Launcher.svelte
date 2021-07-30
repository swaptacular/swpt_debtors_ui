<script lang="ts">
  import { login } from '../operations'
  import { createAppState } from '../stores'
  import Router from './Router.svelte'
</script>

{#await createAppState()}
  <h1>Launching...</h1>
{:then appState}
  {#if appState }
    <Router appState={appState}/>
  {:else}
    <button on:click={() => login()}>Login</button>
  {/if}
{:catch error}
  <h1>{error.message}</h1>
{/await}
