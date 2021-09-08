<script lang="ts">
  import type { TransferRecord } from '../operations'
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

  function getFailureReason(errorCode: string): string {
    switch (errorCode) {
    case 'CANCELED_BY_THE_SENDER':
      return 'The payment has been canceled the sender.'
    case 'RECIPIENT_IS_UNREACHABLE':
      return "The recipient's account does not exist, or does not accept incoming payments."
    case 'NO_RECIPIENT_CONFIRMATION':
      return "A confirmation from the recipient is required, but has not been obtained."
    case 'TRANSFER_NOTE_IS_TOO_LONG':
      return "The byte-length of the payment note is too big."
    case 'INSUFFICIENT_AVAILABLE_AMOUNT':
      return "The requested amount is not available on the sender's account."
    case 'TERMINATED':
      return "The payment has been terminated due to expired deadline, unapproved "
        + "interest rate change, or some other temporary or correctable condition. If "
        + "the payment is retried with the correct options, chances are that it can "
        + "be committed successfully."
    default:
      return errorCode
    }
  }

  function getTooltip(t: TransferRecord): string {
    let tooltip= `The payment was initiated at ${new Date(t.initiatedAt).toLocaleString()}`
    if (t.result) {
      const finalizedAt = new Date(t.result.finalizedAt).toLocaleString()
      if (t.result.error) {
        const reason = getFailureReason(t.result.error.errorCode)
        tooltip += `, and failed at ${finalizedAt}.`
        tooltip += `The reason for the failure is: "${reason}"`
      } else {
        tooltip += `, and succeeded at ${finalizedAt}.`
      }
    } else {
      tooltip += '.'
    }
    return tooltip
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
