<script lang="ts">
  import { setContext, onMount } from 'svelte'
  import type { AppState } from '../app-state'
  import { logout } from '../operations'
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'
  import ActionPage from './ActionPage.svelte'
  import ActionsPage from './ActionsPage.svelte'
  import TransferPage from './TransferPage.svelte'
  import TransfersPage from './TransfersPage.svelte'
  import ConfigDataPage from './ConfigDataPage.svelte'
  import MakePaymentPage from './MakePaymentPage.svelte'

  export let app: AppState
  export let unauthenticated: boolean

  const { waitingInteractions, alerts, pageModel } = app
  const originalAppState = app
  let seqnum = typeof history.state === 'number' ? history.state : 0

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
    case 'MakePaymentModel':
      return MakePaymentPage
    default:
      throw new Error('unknown page model type')
    }
  }
  function hijackBackButton() {
    history.pushState(++seqnum, '')
  }
  function goBack() {
    hijackBackButton()
    $pageModel.goBack?.()
  }
  async function update(): Promise<void> {
    await app.fetchDataFromServer()
    $pageModel.reload()
  }

  setContext('app', app)
  hijackBackButton()
  onMount(() => {
    addEventListener('popstate', goBack)
    return () => {
      removeEventListener("popstate", goBack)
    }
  })

  $: enusreOriginalAppState(app)
  $: pageComponent = getPageComponent($pageModel.type)
</script>

<button on:click={() => $pageModel.goBack?.()}>Back</button>
<button on:click={() => logout()}>Logout</button>
{#if unauthenticated}
  <button on:click={update}>Update!</button>
{:else}
  <button on:click={update}>Update</button>
{/if}

{#if $alerts.length === 0 && $waitingInteractions.size > 0 }
  <Hourglass />
{/if}
<Alerts alerts={$alerts} {app} />
<svelte:component this={pageComponent} model={$pageModel} {app} />
