<script lang="ts">
  import {onMount} from "svelte"
  import type { AppState, TransfersModel, TransferRecord } from '../app-state'
  import InfiniteScroll from "./InfiniteScroll.svelte"

  export let app: AppState
  export let model: TransfersModel
  let containerElement: HTMLElement
  let transfers: TransferRecord[] = []
  let newBatch = model.transfers

  async function fetchNewBatch(): Promise<void> {
    newBatch = await model.fetchTransfers()
  }

  function showTransfer(transferUri: string): void {
    const scrollTop = containerElement.scrollTop
    const scrollLeft = containerElement.scrollLeft
    app.showTransfer(transferUri, () => {
      app.pageModel.set({ ...model, transfers, scrollTop, scrollLeft })
    })
  }

  onMount(() => {
    containerElement.scrollTop = model.scrollTop ?? containerElement.scrollTop
    containerElement.scrollLeft = model.scrollLeft ?? containerElement.scrollLeft
  })

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

<h1>Transfers Page</h1>

<div class="list">
  <ul bind:this={containerElement}>
    {#each transfers as transfer, n }
      <li>
        {n}
        <a href="." on:click|preventDefault={() => showTransfer(transfer.uri)}>
          {`${transfer.amount} to ${transfer.paymentInfo.payeeName}`}
        </a>
      </li>
    {/each}
    <InfiniteScroll hasMore={newBatch.length > 0} threshold={100} on:loadMore={fetchNewBatch} />
  </ul>
</div>
