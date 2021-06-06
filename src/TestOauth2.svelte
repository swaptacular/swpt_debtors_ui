<script lang="ts">
  import {oauth2TokenSource} from './oauth2/index.js'
  import {ServerSession} from './server-api/index.js'

  const session = new ServerSession(oauth2TokenSource)

  async function login() {
    await session.login()
  }

  async function logout() {
    await session.logout()
  }
</script>


{#await session.debtorUrlPromise}
  <h1>...</h1>
{:then debtorUrl}
  {#if debtorUrl === undefined }
    <button on:click={login}>Login</button>
  {:else}
    <h3>{debtorUrl}</h3>
    {#await session.get(debtorUrl)}
      ...
    {:then response}
      <pre>{response.data.account.uri}</pre>
      <button on:click={logout}>Logout</button>
    {:catch}
      error
    {/await}
  {/if}
{:catch e}
  <h1>{e.message}</h1>
{/await}

