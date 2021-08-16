<script lang="ts">
  import type { AppState, MakePaymentModel } from '../app-state'
  import QrScanner from './QrScanner.svelte'

  export let app: AppState
  export let model: MakePaymentModel
  assert(model)

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
</script>

<button on:click={() => app.showActions()}>Back</button>

<h1>Make Payment Page</h1>

<QrScanner />

<button on:click={() => app.initiatePayment(blob)}>Load file</button>
