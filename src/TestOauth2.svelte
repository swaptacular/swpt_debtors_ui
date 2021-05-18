<script lang="ts">
  import {oauth} from './oauth2'

  function authorize() {
    oauth.fetchAuthorizationCode()
  }
</script>

<button on:click={authorize}>Test!</button>
