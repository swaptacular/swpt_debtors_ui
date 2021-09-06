<script lang="ts">
  import type { AppState, MakePaymentModel } from '../app-state'
  import QrScanner from './QrScanner.svelte'
  import Fab, { Label } from '@smui/fab';
  import Page from './Page.svelte'

  export let app: AppState
  export let model: MakePaymentModel
  export const snackbarBottom: string = "84px"
  assert(model)

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
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Make a payment">
  <svelte:fragment slot="content">
    <QrScanner bind:result={scannedValue}/>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <input
      type="file"
      class="invisible"
      accept=".pr0,application/vnd.swaptacular.pr0"
      bind:this={fileInputElement}
      bind:files
      />
    <div class="fab-container">
      <Fab on:click={chooseFile} extended>
        <Label>Select file</Label>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
