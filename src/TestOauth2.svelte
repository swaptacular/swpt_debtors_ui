<script lang="ts">
  import {ServerSession} from './web-api/index.js'

  const session = new ServerSession({onLoginAttempt: async (login) => {
    if (confirm('This operation requires authentication. You will be redirected to the login page.')) {
      return await login()
    }
    return false
  }})

  async function login() {
    // await session.login()
    await session.login(async (login) => await login())
  }

  async function logout() {
    await session.logout()
  }
</script>


{#await session.entrypointPromise}
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

