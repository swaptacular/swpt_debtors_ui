<script lang="ts">
  import type { AppState } from '../app-state'
  import type { AbortTransferActionWithId } from '../operations'

  export let app: AppState
  export let action: AbortTransferActionWithId
  let showFailedCancellationDialog = false

  $: transfer = action.transfer
</script>

<h1>Abort Transfer Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

{#if showFailedCancellationDialog}
  <h1>Failed Cancellation Dialog</h1>
  <button on:click={() => showFailedCancellationDialog = false}>OK</button>
  <button on:click={() => app.dismissTransfer(action)}>Get rid of this payment</button>
{/if}

{#if transfer.result}
  <!-- TODO: Show a retry transfer button here. -->
  <button on:click={() => app.dismissTransfer(action)}>Dismiss</button>
{:else}
  <button on:click={() => app.cancelTransfer(action, () => showFailedCancellationDialog = true)}>Cancel</button>
{/if}
