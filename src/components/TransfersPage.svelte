<script lang="ts">
  import { onMount } from "svelte"
  import type { AppState, TransfersModel, TransferRecord } from '../app-state'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Card, { PrimaryAction } from '@smui/card'
  import InfiniteScroll from "./InfiniteScroll.svelte"
  import Page from './Page.svelte'

  export let app: AppState
  export let model: TransfersModel
  export const snackbarBottom: string = "0px"

  let scrollElement: HTMLElement
  let transfers: TransferRecord[] = []
  let newBatch = model.transfers

  async function fetchNewBatch(): Promise<void> {
    newBatch = await model.fetchTransfers()
  }

  function showTransfer(transferUri: string): void {
    const scrollTop = scrollElement.scrollTop
    const scrollLeft = scrollElement.scrollLeft
    app.showTransfer(transferUri, () => {
      app.pageModel.set({ ...model, transfers, scrollTop, scrollLeft })
    })
  }

  onMount(() => {
    scrollElement.scrollTop = model.scrollTop ?? scrollElement.scrollTop
    scrollElement.scrollLeft = model.scrollLeft ?? scrollElement.scrollLeft
  })

  $: transfers = [...transfers, ...newBatch]
</script>

<Page title="Payments">
  <svelte:fragment slot="content">
    <LayoutGrid>
      {#each transfers as transfer, n }
        <Cell>
          <Card>
            <PrimaryAction on:click={() => showTransfer(transfer.uri)} padded >
              {n}. {`${transfer.amount} to ${transfer.paymentInfo.payeeName}`}
            </PrimaryAction>
          </Card>
        </Cell>
      {/each}
    </LayoutGrid>
    <InfiniteScroll bind:scrollElement hasMore={newBatch.length > 0} threshold={100} on:loadMore={fetchNewBatch} />
  </svelte:fragment>
</Page>
