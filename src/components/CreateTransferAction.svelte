<script lang="ts">
  import type { AppState } from '../app-state'
  import type { CreateTransferActionWithId } from '../operations'
  import { amountToString, stringToAmount } from '../utils'
  import { getCreateTransferActionStatus } from '../operations'
  import { generatePayment0TransferNote } from '../payment-requests'

  export let app: AppState
  export let action: CreateTransferActionWithId
  const debtorConfigData = app.getDebtorConfigData()
  const {
    amountDivisor = 1,
    decimalPlaces = 0,
    unit = '\u00A4',
  } = debtorConfigData.debtorInfo ?? {}
  let amount = amountToString(action.creationRequest.amount, amountDivisor, decimalPlaces)
  let payeeName = action.paymentInfo.payeeName
  let description = action.paymentInfo.description
  let forbidAmountChange = action.requestedAmount > 0

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
        amount: stringToAmount(amount, amountDivisor),
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

<h1>Create Transfer Action</h1>
<form on:input={() => actionManager.markDirty()} on:change={() => actionManager.save()}>
  <p><label>payeeName:<input required minlength="1" maxlength="200" bind:value={payeeName}></label></p>
  <p><label>amount:<input disabled={forbidAmountChange} required type=number min="1" bind:value={amount}> {unit}</label></p>
  {#if description.contentFormat === '.'}
    <p><a href="{description.content}">{description.content}</a></p>
  {:else}
    <p>{description.content}</p>
  {/if}
</form>

<h2>{status}</h2>

<button disabled={dismissButtonIsDisabled} on:click={() => actionManager.remove()}>Dismiss</button>
<button disabled={executeButtonIsDisabled} on:click={() => actionManager.execute()}>{executeButtonLabel}</button>
