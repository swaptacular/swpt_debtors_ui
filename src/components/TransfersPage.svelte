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
      <a href="" on:click|preventDefault={() => app.showTransfer(transfer.uri)}>{`${transfer.amount} to ${transfer.paymentInfo.payeeName}`}</a>
    </li>
  {/each}
</ol>
