<script lang="ts">
  import type {DebtorReservationRequest} from './schema.js'
  import {oauth} from './oauth2'
  import {stringify} from './json-bigint'
  import {parse} from './json-bigint'

  const big = BigInt('123456789012345678901234')
  let x: DebtorReservationRequest = {}
  console.log(x.type)

  function authorize() {
    oauth.fetchAuthorizationCode()
  }
</script>

<h1>{stringify(big)}</h1>
<h1>{parse('123456789012345678901234')}</h1>
<h1>{parse('12345678901.2345678901234')}</h1>
<h1>{parse('1e2')}</h1>
<button on:click={authorize}>Test!</button>
