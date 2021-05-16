<script lang="ts">
  import type {DebtorReservationRequest} from './schema.js'
  import {oauth} from './oauth2'
  let x: DebtorReservationRequest = {}

  function authorize() {
    oauth.fetchAuthorizationCode()
  }
</script>

<button on:click={authorize}>Test!</button>
