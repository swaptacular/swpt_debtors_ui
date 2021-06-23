<script lang="ts">
  import {stringify} from './web-api/json-bigint'
  import {login, logout, obtainUserContext } from './operations'
</script>


{#await obtainUserContext()}
  <h1>...</h1>
{:then userContext}
  {#if !userContext }
    <button on:click={login}>Login</button>
  {:else}
    <!-- <h3>{entrypoint}</h3> -->
    {#await userContext.getDebtorRecord()}
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
