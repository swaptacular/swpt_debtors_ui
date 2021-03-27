<script lang="ts">
  import type {DebtorReservationRequest} from './schema'
  import {oauth} from './oauth2'
  
  let x: DebtorReservationRequest = {}
  console.log(x.type)

  function authorize() {
    oauth.fetchAuthorizationCode()
  }
</script>

<button on:click={authorize}>Test!</button>
