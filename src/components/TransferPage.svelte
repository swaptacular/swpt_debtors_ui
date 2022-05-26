<script lang="ts">
  import { onDestroy } from 'svelte'
  import { generatePr0Blob } from '../payment-requests'
  import type { TransferRecord } from '../operations'
  import { fade } from 'svelte/transition'
  import { getTooltip } from '../utils'
  import type { AppState, TransferModel } from '../app-state'
  import Fab, { Icon } from '@smui/fab';
  import PaymentInfo from './PaymentInfo.svelte'
  import Page from './Page.svelte'

  export let app: AppState
  export let model: TransferModel
  export const snackbarBottom: string = '84px'

  let downloadLinkElement: HTMLAnchorElement
  let currentDataUrl: string

  function getTitle(t: TransferRecord): string {
    switch (true) {
    case t.result?.error !== undefined:
        return 'Failed payment'
    case t.result !== undefined:
      return 'Successful payment'
    default:
      return 'Initiated payment'
    }
  }

  function revokeCurrentDataUrl() {
    if (currentDataUrl) {
      URL.revokeObjectURL(currentDataUrl)
    }
  }

  function generateDataUrl(t: TransferRecord): string {
    const blob = generatePr0Blob({
      ...t.paymentInfo,
      accountUri: t.recipient.uri,
      amount: t.noteFormat === 'PAYMENT0' ? t.amount : 0n,

      // NOTE: The `deadline` field is not set, because
      // deadlines are not supported in the Web API.
    })
    revokeCurrentDataUrl()
    return currentDataUrl = URL.createObjectURL(blob)
  }

  function update(): void {
    app.fetchDataFromServer(() => model.reload())
  }

  onDestroy(revokeCurrentDataUrl)

  $: transfer = model.transfer
  $: payeeName = $transfer.paymentInfo.payeeName
  $: payeeReference = $transfer.paymentInfo.payeeReference
  $: unit = app.unit
  $: unitAmount = app.amountToString($transfer.amount)
  $: description = $transfer.paymentInfo.description
  $: title = getTitle($transfer)
  $: tooltip = getTooltip($transfer)
  $: dataUrl = generateDataUrl($transfer)
  $: downloadNameShort = `Issue ${unitAmount} ${unit.slice(0, 10)} to ${payeeName}`
  $: downloadName = payeeReference ? `${downloadNameShort} - ${payeeReference}` : downloadNameShort
  $: fileName = downloadName.slice(0, 120).replace(/[<>:"/|?*\\]/g, ' ') + '.pr0'
</script>

<style>
  .download-link {
    display: none;
  }
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Payment">
  <svelte:fragment slot="content">
    <PaymentInfo
      {payeeName}
      {unitAmount}
      {description}
      {title}
      {tooltip}
      unit={app.unit}
      />
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <a class="download-link" href={dataUrl} download={fileName} bind:this={downloadLinkElement}>download</a>
      <Fab on:click={() => downloadLinkElement.click()}>
        <Icon class="material-icons">download</Icon>
       </Fab>
    </div>
    {#if !$transfer.result}
      <div out:fade|local="{{ duration: 1000 }}" class="fab-container">
        <Fab on:click={update}>
          <Icon class="material-icons">sync</Icon>
        </Fab>
      </div>
    {/if}
  </svelte:fragment>
</Page>
