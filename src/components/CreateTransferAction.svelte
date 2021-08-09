<script lang="ts">
  import type { AppState } from '../app-state'
  import type { CreateTransferActionWithId } from '../operations'
  import { getCreateTransferActionStatus } from '../operations'

  export let app: AppState
  export let action: CreateTransferActionWithId
  let amount = Number(action.creationRequest.amount)
  let payeeName = action.paymentInfo.payeeName
  let description = action.paymentInfo.description
  let forbidAmountChange = action.requestedAmount > 0

  function createUpdatedAction(): CreateTransferActionWithId {
    return {
      ...action,
      creationRequest: {
        ...action.creationRequest,
        amount: BigInt(amount),
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
  <p><label>amount:<input disabled={forbidAmountChange} required type=number min="1" bind:value={amount}></label></p>
  <p><b>payeeName:</b><span>{payeeName}</span></p>
  {#if description.contentFormat === '.'}
    <p><b>description:</b><a href="{description.content}">{description.content}</a></p>
  {:else}
    <p><b>description:</b><span>{description.content}</span></p>
  {/if}
</form>

<h2>{status}</h2>

<button disabled={dismissButtonIsDisabled} on:click={() => actionManager.remove()}>Dismiss</button>
<button disabled={executeButtonIsDisabled} on:click={() => actionManager.execute()}>{executeButtonLabel}</button>
