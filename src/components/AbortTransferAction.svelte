<script lang="ts">
  import type { AppState } from '../app-state'
  import type { AbortTransferActionWithId } from '../operations'
  import Fab, { Label } from '@smui/fab';
  import Page from './Page.svelte'

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

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Payment problem" snackbarBottom="84px">
  <svelte:fragment slot="content">
    <h1>Abort Transfer Action</h1>
    <dl>
      <dt>actionId:</dt> <dd>{action.actionId}</dd>
      <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
    </dl>
    <!-- TODO: Make this a real dialog. -->
    {#if showFailedCancellationDialog}
      <h1>Failed Cancellation Dialog</h1>
      <button on:click={closeDialog}>OK</button>
      <button on:click={dismiss}>Get rid of this payment</button>
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
        <Fab on:click={dismiss} extended>
          <Label>Dismiss</Label>
        </Fab>
      </div>
    {:else}
      <div class="fab-container">
        <Fab color="primary" on:click={cancel} extended>
          <Label>Cancel</Label>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
