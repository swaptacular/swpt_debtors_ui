<script lang="ts">
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'

  export let app: AppState
  export let model: ActionsModel
  const LOCALSTORAGE_KEY = 'debtors.showForeignActions'
  let showForeignActions = localStorage.getItem(LOCALSTORAGE_KEY) === 'true'

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

  function separateForeignActions(allActions: ActionRecordWithId[]): [ActionRecordWithId[], ActionRecordWithId[]] {
    let regularActions = []
    let foreignActions = []
    for (const action of allActions) {
      if (action.actionType === 'AbortTransfer' && !action.transfer.originatesHere) {
        foreignActions.push(action)
      } else {
        regularActions.push(action)
      }
    }
    return [regularActions, foreignActions]
  }

  $: actions = model.actions
  $: [regularActions, foreignActions] = separateForeignActions($actions)
  $: localStorage.setItem(LOCALSTORAGE_KEY, String(showForeignActions))
</script>

<h1>Actions Page</h1>

{#if regularActions.length > 0 }
  <ol>
    {#each regularActions as action }
      <li><a href="." on:click|preventDefault={() => app.showAction(action.actionId)}>{action.actionType}</a></li>
    {/each}
  </ol>
{/if}

<p>
{#if foreignActions.length > 0 }
  <input type=checkbox bind:checked={showForeignActions}> Show failed transfers initiated from other devices
  {#if showForeignActions }
    <ol>
      {#each foreignActions as action }
        <li><a href="." on:click|preventDefault={() => app.showAction(action.actionId)}>{action.actionType}</a></li>
      {/each}
    </ol>
  {/if}
{/if}
</p>

<button on:click={() => app.showConfig()}>Configuration</button>
<button on:click={() => app.showTransfers()}>Show Transfers</button>
<button on:click={() => app.initiatePayment(blob)}>Make Payment</button>
