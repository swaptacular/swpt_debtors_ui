<script lang="ts">
  import type { AppState, MakePaymentModel } from '../app-state'
  import QrScanner from './QrScanner.svelte'

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

<h1>Make Payment Page</h1>

<QrScanner bind:result={scannedValue}/>

<button on:click={() => app.initiatePayment(blob)}>Load file</button>
