<script lang="ts">
  import type { AppState, TransferModel } from '../app-state'

  export let app: AppState
  export let model: TransferModel

  $: transfer = model.transfer
</script>

<button on:click={() => model.goBack()}>Back</button>

<h1>Transfer Page</h1>
<dl>
  <dt>UUID:</dt> <dd>{$transfer.transferUuid}</dd>
  <dt>time:</dt> <dd>{new Date($transfer.time).toISOString()}</dd>
  <dt>initiatedAt:</dt> <dd>{new Date($transfer.initiatedAt).toISOString()}</dd>
  <dt>payeeName:</dt> <dd>{$transfer.paymentInfo.payeeName}</dd>
  <dt>amount:</dt> <dd>{$transfer.amount}</dd>
  <dt>noteFormat:</dt> <dd>{$transfer.noteFormat}</dd>
  <dt>note:</dt> <dd>{$transfer.note}</dd>
  <dt>aborted:</dt> <dd>{$transfer.aborted}</dd>
  <dt>finalizedAt:</dt> <dd>{$transfer.result ? new Date($transfer.result.finalizedAt).toISOString() : ''}</dd>
  <dt>error:</dt> <dd>{$transfer.result?.error?.errorCode}</dd>
</dl>

{#if $transfer.result}
  <button on:click={() => app.retryTransfer($transfer)}>Make another payment</button>
{/if}
