<script lang="ts">
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'

  export let app: AppState
  export let model: ActionsModel
  const LOCALSTORAGE_KEY = 'debtors.showForeignActions'
  let showForeignActions = localStorage.getItem(LOCALSTORAGE_KEY) === 'true'

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

<button on:click={() => app.showConfig()}>Currency</button>
<button on:click={() => app.showTransfers()}>Transfers</button>
<button on:click={() => app.scanQrCode()}>Make Payment</button>
