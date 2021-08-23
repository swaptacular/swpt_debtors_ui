<script lang="ts">
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import ActionCard from './ActionCard.svelte'
  import Checkbox from '@smui/checkbox'
  import FormField from '@smui/form-field'
  import Page from './Page.svelte'

  export let app: AppState
  export let model: ActionsModel
  export const snackbarBottom: string = '84px'

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

<Page title="Actions">
  <svelte:fragment slot="content">
    {#if regularActions.length > 0 }
      <LayoutGrid>
        {#each regularActions as action }
          <Cell>
            <ActionCard {action} />
          </Cell>
        {/each}
      </LayoutGrid>
    {/if}
    <p>
    {#if foreignActions.length > 0 }
      <FormField>
        <Checkbox bind:checked={showForeignActions} />
        <span slot="label">Show failed transfers initiated from other devices.</span>
      </FormField>
      {#if showForeignActions }
        <LayoutGrid>
          {#each foreignActions as action }
            <Cell>
              <ActionCard {action} />
            </Cell>
          {/each}
        </LayoutGrid>
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
