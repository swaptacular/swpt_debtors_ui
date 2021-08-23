<script lang="ts">
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'
  import Fab, { Icon } from '@smui/fab';
  import Page from './Page.svelte'

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

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Actions" snackbarBottom="84px">
  <svelte:fragment slot="content">
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
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={() => app.showConfig()}>
        <Icon class="material-icons">build</Icon>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab on:click={() => app.showTransfers()}>
        <Icon class="material-icons">list</Icon>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab on:click={() => app.scanQrCode()}>
        <Icon class="material-icons">local_atm</Icon>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
