<script lang="ts">
  import type { AppState } from '../app-state'
  import type { AbortTransferActionWithId } from '../operations'

  export let app: AppState
  export let action: AbortTransferActionWithId
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
</script>

<h1>Abort Transfer Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

{#if showFailedCancellationDialog}
  <h1>Failed Cancellation Dialog</h1>
  <button on:click={closeDialog}>OK</button>
  <button on:click={dismiss}>Get rid of this payment</button>
{/if}

{#if transfer.result}
  <button on:click={retry}>Retry</button>
  <button on:click={dismiss}>Dismiss</button>
{:else}
  <button on:click={cancel}>Cancel</button>
{/if}
