<script lang="ts">
  import { getContext } from 'svelte'
  import type { Writable } from 'svelte/store'
  import type { AppState } from '../app-state'
  import { logout } from '../operations'
  import TopAppBar, {
    Row,
    Section,
    Title,
    AutoAdjust,
  } from '@smui/top-app-bar'
  import IconButton from '@smui/icon-button'
  import Snackbar, { Actions, Label } from '@smui/snackbar'
  import Button from '@smui/button'
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'

  export let title: string
  export let snackbarBottom: string = '0'

  const app: AppState = getContext('app')
  const unauthenticated: Writable<boolean> = getContext('unauthenticated')
  const authenticationError: Writable<boolean> = getContext('authenticationError')
  const networkError: Writable<boolean> = getContext('networkError')
  const httpError: Writable<boolean> = getContext('httpError')
  const { waitingInteractions, alerts, pageModel } = app

  let topAppBar: any
  let authenticationErrorSnackbar: any
  let networkErrorSnackbar: any
  let httpErrorSnackbar: any

  function confirmLogout() {
    if (confirm('You will be logged out. To use the application again, you will have to log in.')) {
      logout()
    }
  }
  async function update(): Promise<void> {
    await app.fetchDataFromServer()
    $pageModel.reload()
  }

  $: $authenticationError && authenticationErrorSnackbar?.open()
  $: $networkError && networkErrorSnackbar?.open()
  $: $httpError && httpErrorSnackbar?.open()
</script>

<style>
  /* Hide everything above this component. */
  :global(body, html) {
    display: block !important;
    height: auto !important;
    width: auto !important;
    position: static !important;
  }
  .snackbars :global(.mdc-snackbar) {
    bottom: var(--snackbar-bottom);
  }
  .floating {
    display: flex;
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100%;
    justify-content: center;
  }
</style>

<TopAppBar dense variant="fixed" bind:this={topAppBar}>
  <Row>
    <Section>
      {#if $pageModel.goBack}
        <IconButton class="material-icons" on:click={() => $pageModel.goBack?.()}>
          arrow_back
        </IconButton>
      {/if}
      <Title>{title}</Title>
    </Section>

    <Section align="end" toolbar>
      <IconButton class="material-icons" aria-label="Reload" on:click={update}>
        {#if $unauthenticated}
          sync_problem
        {:else}
          sync
        {/if}
      </IconButton>
      <IconButton class="material-icons" aria-label="Logout" on:click={confirmLogout}>
        exit_to_app
      </IconButton>
    </Section>
  </Row>
</TopAppBar>

<AutoAdjust {topAppBar}>
  {#if $alerts.length > 0}
    <Alerts alerts={$alerts} {app} />
  {:else if $waitingInteractions.size > 0 }
    <Hourglass />
  {/if}
  <slot name="content"></slot>

  <div class="floating">
    <slot name="floating"></slot>
  </div>

  <div class="snackbars" style="--snackbar-bottom: {snackbarBottom}">
    <slot name="snackbars"></slot>

    <Snackbar bind:this={authenticationErrorSnackbar}>
      <Label>An authentication error has occured.</Label>
      <Actions>
        <Button on:click={update}>Login</Button>
      </Actions>
    </Snackbar>

    <Snackbar bind:this={networkErrorSnackbar}>
      <Label>A network error has occured.</Label>
    </Snackbar>

    <Snackbar bind:this={httpErrorSnackbar}>
      <Label>A server error has occured.</Label>
    </Snackbar>
  </div>
</AutoAdjust>
