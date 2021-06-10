<script lang="ts">
  import {stringify} from './web-api/json-bigint'
  import {login, logout, update, determineIfLoggedIn, getDebtorRecord} from './operations'
  update()
</script>


{#await determineIfLoggedIn()}
  <h1>...</h1>
{:then isLoggedIn}
  {#if !isLoggedIn }
    <button on:click={login}>Login</button>
  {:else}
    <!-- <h3>{entrypoint}</h3> -->
    {#await getDebtorRecord()}
      ...
    {:then debtorRecord}
      <pre>{stringify(debtorRecord)}</pre>
      <button on:click={logout}>Logout</button>
    {:catch}
      error
    {/await}
  {/if}
{:catch e}
  <h1>{e.message}</h1>
{/await}
