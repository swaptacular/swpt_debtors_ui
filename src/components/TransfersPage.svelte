<script lang="ts">
  import {onMount} from "svelte"
  import type { AppState, TransfersModel, TransferRecord } from '../app-state'
  import InfiniteScroll from "./InfiniteScroll.svelte"

  export let app: AppState
  export let model: TransfersModel
  let transfers: TransferRecord[] = []
  let newBatch: TransferRecord[] = []

  async function fetchTransfers() {
    newBatch = await model.fetchTransfers()
  }

  onMount(fetchTransfers)

  $: transfers = [...transfers, ...newBatch]
</script>

<style>
  .list {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  ul {
    box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.2),
      0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 2px 1px -1px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    border-radius: 2px;
    width: 100%;
    max-width: 400px;
    max-height: 400px;
		background-color: white;
    overflow-x: scroll;
    list-style: none;
    padding: 0;
  }

  li {
    padding: 15px;
    box-sizing: border-box;
    transition: 0.2s all;
    font-size: 14px;
  }

  li:hover {
    background-color: #eeeeee;
  }
</style>

<button on:click={() => app.showActions()}>Back</button>

<h1>Transfers Page</h1>

<div class="list">
  <ul>
    {#each transfers as transfer, n }
      <li>
        {n} <a href="." on:click|preventDefault={() => app.showTransfer(transfer.uri)}>{`${transfer.amount} to ${transfer.paymentInfo.payeeName}`}</a>
      </li>
    {/each}
    <InfiniteScroll hasMore={newBatch.length !== 0} threshold={100} on:loadMore={fetchTransfers} />
  </ul>
</div>
