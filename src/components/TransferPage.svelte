<script lang="ts">
  import type { TransferRecord } from '../operations'
  import { getTooltip } from '../utils'
  import type { AppState, TransferModel } from '../app-state'
  import Fab, { Icon } from '@smui/fab';
  import PaymentInfo from './PaymentInfo.svelte'
  import Page from './Page.svelte'

  export let app: AppState
  export let model: TransferModel
  export let snackbarBottom: string

  const maxUnitAmount =  Number(app.amountToString(2n ** 63n - 1000000n))

  function getTitle(t: TransferRecord): string {
    switch (true) {
    case t.result?.error !== undefined:
        return 'Failed payment'
    case t.result !== undefined:
      return 'Successful payment'
    default:
      return 'Initiated payment'
    }
  }

  $: transfer = model.transfer
  $: snackbarBottom = $transfer.result ? '84px' : '0px'
  $: payeeName = $transfer.paymentInfo.payeeName
  $: unitAmount = app.amountToString($transfer.amount)
  $: description = $transfer.paymentInfo.description
  $: title = getTitle($transfer)
  $: tooltip = getTooltip($transfer)
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Payment">
  <svelte:fragment slot="content">
    <PaymentInfo
      {payeeName}
      {unitAmount}
      {description}
      {title}
      {tooltip}
      {maxUnitAmount}
      unit={app.unit}
      />
  </svelte:fragment>

  <svelte:fragment slot="floating">
    {#if $transfer.result}
      <div class="fab-container">
        <Fab on:click={() => app.retryTransfer($transfer)}>
          <Icon class="material-icons">replay</Icon>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
