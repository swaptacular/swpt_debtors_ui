<script lang="ts">
  import type { AppState, ActionsModel } from '../app-state'

  export let app: AppState
  export let model: ActionsModel

  const blob = new Blob([
    'PR0\n',
    '\n',
    'swpt:112233445566778899/998877665544332211\n',
    'Payee Name\n',
    '1000\n',
    '2001-01-01\n',
    '12d3a45642665544\n',
    '.\n',
    'http://example.com'
  ])

  $: actions = model.actions
</script>

<h1>Actions Page</h1>
<ol>
  {#each $actions as action }
    <li>{action.actionType} <button on:click={() => app.showAction(action.actionId)}>Show</button></li>
  {/each}
</ol>
<button on:click={() => app.initiatePayment(blob)}>Make Payment</button>
