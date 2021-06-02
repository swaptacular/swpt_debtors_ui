<script lang="ts">
  import {oauth2TokenSource} from './oauth2/index.js'
  import {ServerSession} from './server-api/index.js'

  const session = new ServerSession(oauth2TokenSource)
  let token = oauth2TokenSource.getToken({attemptLogin: false})

  async function authorize() {
    token = oauth2TokenSource.getToken()
  }

  async function logout() {
    await session.logout()
  }
</script>


{#await token}
  <h1>no token</h1>
{:then t}
  <h1>{t}</h1>
{:catch e}
  <h1>{e.message}</h1>
{/await}
<button on:click={authorize}>Test!</button>
<button on:click={logout}>Logout</button>
