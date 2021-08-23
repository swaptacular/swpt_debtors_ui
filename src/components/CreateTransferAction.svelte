<script lang="ts">
  import type { AppState } from '../app-state'
  import type { CreateTransferActionWithId } from '../operations'
  import { getCreateTransferActionStatus } from '../operations'
  import { generatePayment0TransferNote } from '../payment-requests'
  import Fab, { Icon, Label } from '@smui/fab';
  import Page from './Page.svelte'

  export let app: AppState
  export let action: CreateTransferActionWithId
  export const snackbarBottom: string = "84px"

  const forbidAmountChange = action.requestedAmount > 0
  const deadline = action.requestedDeadline
  const description = action.paymentInfo.description
  let amount = app.amountToString(action.creationRequest.amount)
  let payeeName = action.paymentInfo.payeeName

  function createUpdatedAction(): CreateTransferActionWithId {
    const paymentInfo = {
      ...action.paymentInfo,
      payeeName,
    }
    return {
      ...action,
      paymentInfo,
      creationRequest: {
        ...action.creationRequest,
        amount: app.stringToAmount(amount),
        noteFormat: action.requestedAmount ? 'PAYMENT0' : 'payment0',
        note: generatePayment0TransferNote(paymentInfo, app.noteMaxBytes),
      },
    }
  }

  $: status = getCreateTransferActionStatus(action)
  $: actionManager = app.createActionManager(action, createUpdatedAction)
  $: executeButtonLabel = (status !== 'Sent' && status !== 'Timed out') ? 'Send' : 'Acknowledge'
  $: executeButtonIsDisabled = (status === 'Failed')
  $: dismissButtonIsDisabled = (status === 'Not confirmed' || status === 'Sent' || status === 'Timed out')
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Payment">
  <svelte:fragment slot="content">
    <h1>Create Transfer Action</h1>
    <form on:input={() => actionManager.markDirty()} on:change={() => actionManager.save()}>
      {#if deadline}
        <p><b>Payment deadlines ({deadline.toISOString()}) are not supported, and will be ignored.</b></p>
      {/if}
      <p><label>payeeName:<input required minlength="1" maxlength="200" bind:value={payeeName}></label></p>
      <p><label>amount:<input disabled={forbidAmountChange} required type=number min="1" bind:value={amount}> {app.unit}</label></p>
      {#if description.contentFormat === '.'}
        <p><a href="{description.content}">{description.content}</a></p>
      {:else}
        <p>{description.content}</p>
      {/if}
    </form>
    <h2>{status}</h2>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    {#if !dismissButtonIsDisabled}
      <div class="fab-container">
        <Fab on:click={() => actionManager.remove()} extended>
          <Label>Dismiss</Label>
        </Fab>
      </div>
    {/if}
    {#if !executeButtonIsDisabled}
      <div class="fab-container">
        <Fab color="primary" on:click={() => actionManager.execute()} extended>
          <Icon class="material-icons">monetization_on</Icon>
          <Label>{executeButtonLabel}</Label>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
