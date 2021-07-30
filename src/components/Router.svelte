<script lang="ts">
  import type {AppState} from '../stores'
  import { logout } from '../operations'
  import Alerts from './Alerts.svelte'
  import ActionPage from './ActionPage.svelte'
  import ActionsPage from './ActionsPage.svelte'

  export let appState: AppState
  let page = appState.page
  let alerts = appState.alerts

  function getPageComponent(pageType: string) {
    switch (pageType) {
    case 'Action':
      return ActionPage
    case 'Actions':
      return ActionsPage
    default:
      throw new Error('unknown page type')
    }
  }
  $: component = getPageComponent($page.type)
</script>

<button on:click={() => logout()}>Logout</button>
<Alerts alerts={$alerts} />
<svelte:component this={component} page={$page} />
