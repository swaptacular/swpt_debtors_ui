<script lang="ts">
  import type { AppState, TransferModel } from '../app-state'
  import Fab, { Icon } from '@smui/fab';
  import Page from './Page.svelte'

  export let app: AppState
  export let model: TransferModel
  export let snackbarBottom: string

  $: transfer = model.transfer
  $: snackbarBottom = $transfer.result ? '84px' : '0px'
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Transfer">
  <svelte:fragment slot="content">
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
  </svelte:fragment>

  <svelte:fragment slot="floating">
    {#if $transfer.result}
      <div class="fab-container">
        <Fab color="primary" on:click={() => app.retryTransfer($transfer)}>
          <Icon class="material-icons">replay</Icon>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
