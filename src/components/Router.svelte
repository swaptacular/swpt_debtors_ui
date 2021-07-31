<script lang="ts">
  import { setContext } from 'svelte';
  import type { AppState } from '../stores'
  import { logout } from '../operations'
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'
  import ActionPage from './ActionPage.svelte'
  import ActionsPage from './ActionsPage.svelte'

  export let appState: AppState
  const { waitingInteractions, alerts, pageModel } = appState
  setContext('appState', appState)

  function getPageComponent(pageModelType: string) {
    switch (pageModelType) {
    case 'ActionModel':
      return ActionPage
    case 'ActionsModel':
      return ActionsPage
    default:
      throw new Error('unknown page model type')
    }
  }
  $: pageComponent = getPageComponent($pageModel.type)
</script>

<button on:click={() => logout()}>Logout</button>
{#if $alerts.length === 0 && $waitingInteractions.size > 0 }
  <Hourglass />
{/if}
<Alerts alerts={$alerts} />
<svelte:component this={pageComponent} model={$pageModel} />
