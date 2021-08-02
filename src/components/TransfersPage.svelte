<script lang="ts">
  import type { AppState, TransfersModel } from '../app-state'

  export let app: AppState
  export let model: TransfersModel

  $: transfers = model.transfers
</script>

<button on:click={() => app.showActions()}>Back</button>

<h1>Transfers Page</h1>
<ol>
  {#each $transfers as transfer }
    <li>
      {`${transfer.amount} to ${transfer.paymentInfo.payeeName}`}
      <button on:click={() => app.showTransfer(transfer.uri)}>Show</button>
    </li>
  {/each}
</ol>
