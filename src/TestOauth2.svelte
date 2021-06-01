<script lang="ts">
  import {oauth2TokenSource} from './oauth2'

  let token = oauth2TokenSource.getToken({attemptLogin: false})

  async function authorize() {
    token = await oauth2TokenSource.getToken()
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
