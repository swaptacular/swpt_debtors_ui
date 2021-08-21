<script lang="ts">
  import { setContext, onMount } from 'svelte'
  import type { AppState } from '../app-state'
  import { logout } from '../operations'
  import TopAppBar, {
    Row,
    Section,
    Title,
    AutoAdjust,
  } from '@smui/top-app-bar'
  import IconButton from '@smui/icon-button'
  import Banner, { Label } from '@smui/banner'
  import Button from '@smui/button'
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
  export let authenticationError: boolean
  export let networkError: boolean
  export let httpError: boolean

  const { waitingInteractions, alerts, pageModel } = app
  const originalAppState = app
  let seqnum = typeof history.state === 'number' ? history.state : 0
  let topAppBar: HTMLElement
  let pageTitle: string
  let collapsed = false  // TODO: Do we need this?

  function enusreOriginalAppState(appState: AppState): void {
    if (appState !== originalAppState) throw new Error('unoriginal app state')
  }
  function getPageComponent(pageModelType: string) {
    switch (pageModelType) {
    case 'ActionModel':
      pageTitle = 'Action'
      return ActionPage
    case 'ActionsModel':
      pageTitle = 'Actions'
      return ActionsPage
    case 'TransferModel':
      pageTitle = 'Transfer'
      return TransferPage
    case 'TransfersModel':
      pageTitle = 'Transfers'
      return TransfersPage
    case 'ConfigDataModel':
      pageTitle = 'Currency'
      return ConfigDataPage
    case 'MakePaymentModel':
      pageTitle = 'Make payment'
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
  function acknowledgeAuthenticationError(event: any) {
    if (event.detail.reason !== undefined) {
      update()
    }
  }
  function confirmLogout() {
    if (confirm('You will be logged out. To use the application again, you will have to log in.')) {
      logout()
    }
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

<style>
  /* Hide everything above this component. */
  :global(body, html) {
    display: block !important;
    height: auto !important;
    width: auto !important;
    position: static !important;
  }
</style>

<TopAppBar dense variant="fixed" bind:this={topAppBar} bind:collapsed>
  <Row>
    <Section>
      {#if $pageModel.goBack}
        <IconButton class="material-icons" on:click={() => $pageModel.goBack?.()}>arrow_back</IconButton>
      {/if}
      <Title>{pageTitle}</Title>
    </Section>
    <Section align="end" toolbar>
      <IconButton class="material-icons" aria-label="Reload" on:click={update}>
        {#if unauthenticated}
          sync_problem
        {:else}
          sync
        {/if}
      </IconButton>
      <IconButton class="material-icons" aria-label="Logout" on:click={confirmLogout}>exit_to_app</IconButton>
      <!-- <IconButton class="material-icons" aria-label="More">more_vert</IconButton> -->
    </Section>
  </Row>
</TopAppBar>

<AutoAdjust {topAppBar}>
  <Banner open={authenticationError} on:MDCBanner:closed={acknowledgeAuthenticationError}>
    <Label slot="label">An authentication error has occured.</Label>
    <svelte:fragment slot="actions">
      <Button>Login</Button>
    </svelte:fragment>
  </Banner>
  <Banner open={networkError}>
    <Label slot="label">A network error has occured.</Label>
    <svelte:fragment slot="actions">
      <Button>OK</Button>
    </svelte:fragment>
  </Banner>
  <Banner open={httpError}>
    <Label slot="label">A server error has occured.</Label>
    <svelte:fragment slot="actions">
      <Button>OK</Button>
    </svelte:fragment>
  </Banner>

  <Alerts alerts={$alerts} {app} />

  {#if $alerts.length === 0 && $waitingInteractions.size > 0 }
    <Hourglass />
  {/if}

  <svelte:component this={pageComponent} model={$pageModel} {app} />
</AutoAdjust>
