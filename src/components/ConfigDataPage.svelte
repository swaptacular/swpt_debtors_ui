<script lang="ts">
  import type { AppState, ConfigDataModel } from '../app-state'
  import QrCode from 'svelte-qrcode'

  export let app: AppState
  export let model: ConfigDataModel
  assert(model)

  const debtorConfigData = app.getDebtorConfigData()
  const interestRate = debtorConfigData.interestRate
  const info = debtorConfigData.debtorInfo
  const link = `${app.publicInfoDocumentUri}#${app.debtorIdentityUri}`
</script>

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

<QrCode
  value="{link}"
  size="260"
  padding="30"
  errorCorrection="L"
  background="#FFFFFF"
  color="#000000"
/>
<p>
  <a href={link} target="blank">Debtor info document</a>
</p>

<button on:click={() => app.editConfig(debtorConfigData)}>Edit</button>
