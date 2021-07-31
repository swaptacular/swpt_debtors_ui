<script lang="ts">
  import { setContext } from 'svelte';
  import type {AppState} from '../stores'
  import { logout } from '../operations'
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'
  import ActionPage from './ActionPage.svelte'
  import ActionsPage from './ActionsPage.svelte'

  export let appState: AppState
  const page = appState.page
  const alerts = appState.alerts
  const waitingInteractions = appState.waitingInteractions
  setContext('appState', appState)

  function getPageComponent(pageType: string) {
    switch (pageType) {
    case 'ActionPage':
      return ActionPage
    case 'ActionsPage':
      return ActionsPage
    default:
      throw new Error('unknown page type')
    }
  }
  $: pageComponent = getPageComponent($page.type)
</script>

<button on:click={() => logout()}>Logout</button>
{#if $alerts.length === 0 && $waitingInteractions.size > 0 }
  <Hourglass />
{/if}
<Alerts alerts={$alerts} />
<svelte:component this={pageComponent} page={$page} />
