<script lang="ts">
  import type { AppState, MakePaymentModel } from '../app-state'
  import QrScanner from './QrScanner.svelte'
  import Fab, { Icon } from '@smui/fab';
  import Page from './Page.svelte'

  export let app: AppState
  export let model: MakePaymentModel
  assert(model)

  let scannedValue: string | undefined

  const blob = new Blob([
    'PR0\n',
    '\n',
    'swpt:6199429176/998877665544332211\n',
    'Payee Name\n',
    '1000\n',
    '2001-01-01\n',
    '12d3a45642665544\n',
    '.\n',
    'http://example.com'
  ])

  $: {
    if (scannedValue) {
      app.initiatePayment(new Blob([scannedValue]))
    }
  }
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Make payment" snackbarBottom="84px">
  <svelte:fragment slot="content">
    <QrScanner bind:result={scannedValue}/>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={() => app.initiatePayment(blob)}>
        <Icon class="material-icons">insert_drive_file</Icon>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
