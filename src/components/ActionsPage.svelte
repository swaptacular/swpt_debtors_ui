<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, ActionsModel} from '../stores'

  export let page: ActionsModel
  const actions = page.actions
  const appState: AppState = getContext('appState')

  const blob = Promise.resolve(new Blob([
    'PR0\n',
    '\n',
    'swpt:112233445566778899/998877665544332211\n',
    'Payee Name\n',
    '1000\n',
    '2001-01-01\n',
    '12d3a45642665544\n',
    '.\n',
    'http://example.com'
  ]))
</script>

<h1>Actions Page</h1>
<ol>
  {#each $actions as action }
    <li>{action.actionType} <button on:click={() => appState.showAction(action.actionId)}>Show</button></li>
  {/each}
</ol>
<button on:click={() => appState.initiatePayment(blob)}>Make Payment</button>
