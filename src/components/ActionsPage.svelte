<script lang="ts">
  import { onMount } from "svelte"
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import ActionCard from './ActionCard.svelte'
  import Checkbox from '@smui/checkbox'
  import FormField from '@smui/form-field'
  import Paper, { Title, Content } from '@smui/paper'
  import Page from './Page.svelte'
  import Card, { Actions, Content as CardContent } from '@smui/card'
  import Button, { Label } from '@smui/button'

  export let app: AppState
  export let model: ActionsModel
  export const snackbarBottom: string = '84px'

  const LOCALSTORAGE_KEY = 'debtors.showForeignActions'
  const debtorConfigData = app.getDebtorConfigData()
  const scrollElement = document.documentElement
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

  function showAction(actionId: number): void {
    const scrollTop = scrollElement.scrollTop
    const scrollLeft = scrollElement.scrollLeft
    app.showAction(actionId, () => {
      app.pageModel.set({ ...model, scrollTop, scrollLeft })
    })
  }

  onMount(() => {
    scrollElement.scrollTop = model.scrollTop ?? scrollElement.scrollTop
    scrollElement.scrollLeft = model.scrollLeft ?? scrollElement.scrollLeft
  })

  $: actions = model.actions
  $: [regularActions, foreignActions] = separateForeignActions($actions)
  $: localStorage.setItem(LOCALSTORAGE_KEY, String(showForeignActions))
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
  .no-actions {
    margin: 36px 18px 26px 18px;
    text-align: center;
    color: #bbb;
  }
</style>

<Page title="Actions">
  <svelte:fragment slot="content">
    {#if regularActions.length > 0 }
      <LayoutGrid>
        {#each regularActions as action }
          <Cell>
            <ActionCard {action} show={() => showAction(action.actionId)} />
          </Cell>
        {/each}
      </LayoutGrid>
    {:else}
      {#if debtorConfigData.debtorInfo}
        <p class="no-actions">No pending actions</p>
      {:else}
        <LayoutGrid>
          <Cell span={12}>
            <Paper>
              <Title>Are you new to Swaptacular?</Title>
              <Content>
                Every time this app starts, you will see the "Actions"
                screen first. It shows things that require your
                attention &ndash; like actions that have been started,
                but have not been finalized:
              </Content>
            </Paper>
          </Cell>
          <Cell>
            <Card>
              <CardContent>
                A new digital currency have been created for
                you. Before everybody can use it, you need to specify
                some basic information about your currency &ndash the
                name of the issuer, the interest rate, and few other
                things.
              </CardContent>
              <Actions fullBleed>
                <Button on:click={() => app.editConfig(debtorConfigData)}>
                  <Label>Configure currency</Label>
                  <i class="material-icons" aria-hidden="true">arrow_forward</i>
                </Button>
              </Actions>
            </Card>
          </Cell>
        </LayoutGrid>
      {/if}
    {/if}
    {#if foreignActions.length > 0 }
      <LayoutGrid>
        <Cell span={12}>
          <FormField>
            <Checkbox bind:checked={showForeignActions} />
            <span slot="label">Show failed payments initiated from other devices.</span>
          </FormField>
        </Cell>
      </LayoutGrid>
      {#if showForeignActions }
        <LayoutGrid>
          {#each foreignActions as action }
            <Cell>
              <ActionCard color="secondary" {action} show={() => showAction(action.actionId)} />
            </Cell>
          {/each}
        </LayoutGrid>
      {/if}
    {/if}
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
