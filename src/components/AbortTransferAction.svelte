<script lang="ts">
  import { getTooltip } from '../utils'
  import type { AppState } from '../app-state'
  import type { AbortTransferActionWithId } from '../operations'
  import Fab, { Label } from '@smui/fab';
  import Button, { Label as ButtonLabel } from '@smui/button'
  import { Title, Content, Actions, InitialFocus } from '@smui/dialog'
  import Dialog from './Dialog.svelte'
  import PaymentInfo from './PaymentInfo.svelte'
  import Page from './Page.svelte'

  export let app: AppState
  export let action: AbortTransferActionWithId
  export const snackbarBottom: string = "84px"

  let showFailedCancellationDialog = false

  function retry() {
    app.retryTransfer(action)
  }

  function dismiss() {
    app.dismissTransfer(action)
  }

  function cancel() {
    app.cancelTransfer(action, () => { showFailedCancellationDialog = true })
  }

  function closeDialog() {
    showFailedCancellationDialog = false
  }

  $: transfer = action.transfer
  $: payeeName = transfer.paymentInfo.payeeName
  $: payeeReference = transfer.paymentInfo.payeeReference
  $: unitAmount = app.amountToString(transfer.amount)
  $: description = transfer.paymentInfo.description
  $: title = transfer.result ? "Failed payment" : "Delayed payment"
  $: tooltip = getTooltip(transfer)
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title={title}>
  <svelte:fragment slot="content">
    <PaymentInfo
      {payeeName}
      {payeeReference}
      {unitAmount}
      {description}
      {title}
      {tooltip}
      unit={app.unit}
      />

    {#if showFailedCancellationDialog}
      <Dialog
        open
        scrimClickAction=""
        aria-labelledby="failed-cancellation-title"
        aria-describedby="failed-cancellation-content"
        on:MDCDialog:closed={closeDialog}
        >
        <Title id="failed-cancellation-title">Failed payment cancellation</Title>
        <Content id="failed-cancellation-content">
          The attempt to cancel the delayed payment has failed. You
          can get rid of this payment, but please note that it is not
          certain whether the amount has been successfully transferred
          or not.
        </Content>
        <Actions>
          <Button on:click={dismiss}>
            <ButtonLabel>Get rid of this payment</ButtonLabel>
          </Button>
          <Button default use={[InitialFocus]}>
            <ButtonLabel>OK</ButtonLabel>
          </Button>
        </Actions>
      </Dialog>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="floating">
    {#if transfer.result}
      <div class="fab-container">
        <Fab on:click={retry} extended>
          <Label>Retry</Label>
        </Fab>
      </div>
      <div class="fab-container">
        <Fab color="primary" on:click={dismiss} extended>
          <Label>Dismiss</Label>
        </Fab>
      </div>
    {:else}
      <div class="fab-container">
        <Fab color="primary" on:click={cancel} extended>
          <Label>Cancel payment</Label>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
