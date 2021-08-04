<script lang="ts">
  import { setContext } from 'svelte'
  import type { AppState } from '../app-state'
  import { logout } from '../operations'
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'
  import ActionPage from './ActionPage.svelte'
  import ActionsPage from './ActionsPage.svelte'
  import TransferPage from './TransferPage.svelte'
  import TransfersPage from './TransfersPage.svelte'
  import ConfigDataPage from './ConfigDataPage.svelte'

  export let app: AppState

  const { waitingInteractions, alerts, pageModel } = app
  const originalAppState = app
  setContext('app', app)

  function enusreOriginalAppState(appState: AppState): void {
    if (appState !== originalAppState) throw new Error('unoriginal app state')
  }

  function getPageComponent(pageModelType: string) {
    switch (pageModelType) {
    case 'ActionModel':
      return ActionPage
    case 'ActionsModel':
      return ActionsPage
    case 'TransferModel':
      return TransferPage
    case 'TransfersModel':
      return TransfersPage
    case 'ConfigDataModel':
      return ConfigDataPage
    default:
      throw new Error('unknown page model type')
    }
  }

  $: enusreOriginalAppState(app)
  $: pageComponent = getPageComponent($pageModel.type)
</script>

<button on:click={() => logout()}>Logout</button>
{#if $alerts.length === 0 && $waitingInteractions.size > 0 }
  <Hourglass />
{/if}
<Alerts alerts={$alerts} {app} />
<svelte:component this={pageComponent} model={$pageModel} {app} />
