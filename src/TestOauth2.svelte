<script lang="ts">
  import type {DebtorReservationRequest} from './schema'
  import {oauth} from './oauth2'
  import {json_stringify} from './json-bigint'
  import {json_parse} from './json-bigint'

  const big = BigInt('123456789012345678901234')
  let x: DebtorReservationRequest = {}
  console.log(x.type)

  function authorize() {
    oauth.fetchAuthorizationCode()
  }
</script>

<h1>{json_stringify(big)}</h1>
<h1>{json_parse('123456789012345678901234')}</h1>
<h1>{json_parse('12345678901.2345678901234')}</h1>
<h1>{json_parse('1e2')}</h1>
<button on:click={authorize}>Test!</button>
