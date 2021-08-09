<script lang="ts">
  import type { AppState } from '../app-state'

  export let app: AppState
  const data = app.getDebtorConfigData()
  const interestRate = data.interestRate
  const info = data.debtorInfo
</script>

<button on:click={() => app.showActions()}>Back</button>

<h1>Config Data Page</h1>
<dl>
  <dt>interestRate:</dt> <dd>{interestRate}</dd>
  <dt>summary:</dt> <dd>{info?.summary}</dd>
  <dt>debtorName:</dt> <dd>{info?.debtorName}</dd>
  <dt>debtorHomepage:</dt> <dd>{info?.debtorHomepage}</dd>
  <dt>amountDivisor:</dt> <dd>{info?.amountDivisor}</dd>
  <dt>decimalPlaces:</dt> <dd>{info?.decimalPlaces}</dd>
  <dt>unit:</dt> <dd>{info?.unit}</dd>
  <dt>peg:</dt> <dd>{info?.peg}</dd>
</dl>

<button on:click={() => app.editConfig(data)}>Edit</button>
