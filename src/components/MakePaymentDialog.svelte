<script lang="ts">
  import { getContext } from 'svelte'
  import type { AppState } from '../app-state'
  import Dialog, { Title, Content, Actions, InitialFocus } from '@smui/dialog'
  import Button, { Label } from '@smui/button'
  import QrScanner from './QrScanner.svelte'

  export let open: boolean = true

  const app: AppState = getContext('app')
  let scannedValue: string | undefined
  let fileInputElement: HTMLElement
  let files: FileList | undefined

  function chooseFile() {
    fileInputElement.click()
  }

  $: {
    if (scannedValue) {
      app.initiatePayment(new Blob([scannedValue]))
    }
  }
  $: chosenFile = files?.[0]
  $: if (chosenFile) {
    app.initiatePayment(chosenFile)
  }
</script>

<style>
  .invisible {
    display: none;
  }
  .payment-request-help {
    margin-top: 1em;
  }
</style>

<input
  type="file"
  class="invisible"
  accept=".pr0,application/vnd.swaptacular.pr0"
  bind:this={fileInputElement}
  bind:files
  />

{#if open}
  <Dialog
    open
    scrimClickAction=""
    escapeKeyAction=""
    aria-labelledby="payment-dialog-title"
    aria-describedby="payment-dialog-content"
    on:MDCDialog:closed={() => open = false}
    >
    <Title id="payment-dialog-title">Scan the QR code of the payment request</Title>
    <Content id="payment-dialog-content">
      <QrScanner bind:result={scannedValue}/>
      <div class="payment-request-help">
        First, a payment request must be created by the payee. Then,
        you should scan the QR code of the payment request, or load it
        from file.
      </div>
    </Content>
    <Actions>
      <Button on:click={chooseFile}>
        <Label>Load from file</Label>
      </Button>
      <Button default use={[InitialFocus]}>
        <Label>Close</Label>
      </Button>
    </Actions>
  </Dialog>
{/if}
