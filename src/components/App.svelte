<script lang="ts">
  import { setContext, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { createAppState } from '../app-state'
  import type { AppState } from  '../app-state'
  import Snackbar, { Actions, Label } from '@smui/snackbar'
  import IconButton from '@smui/icon-button'
  import Button from '@smui/button'
  import LoginScreen from './LoginScreen.svelte'
  import Router from './Router.svelte'

  const unauthenticated = writable(false)
  setContext('unauthenticated', unauthenticated)

  let snackbarBottom: string = '0px'
  let authenticationErrorSnackbar: any
  let networkErrorSnackbar: any
  let httpErrorSnackbar: any
  let resolveAppStatePromise: (appState?: AppState) => void
  let rejectAppStatePromise: (error: unknown) => void

  const appStatePromise = new Promise<AppState | undefined>((resolve, reject) => {
    resolveAppStatePromise = resolve
    rejectAppStatePromise = reject
  })

  function logError(e: unknown): string {
    console.error(e)
    return 'An unexpected error has occured.'
  }

  async function handleClosedAuthenticationErrorSnackbar(event: any) {
    if (event.detail.reason === 'action') {
      const appState = await appStatePromise
      appState?.fetchDataFromServer()
    }
  }

  onMount(() => {
    addEventListener('update-authentication-error', (event) => {
      unauthenticated.set(true)
      if (!authenticationErrorSnackbar.isOpen()) {
        authenticationErrorSnackbar.open()
      }
      event.preventDefault()
    })
    addEventListener('update-network-error', (event) => {
      if (!networkErrorSnackbar.isOpen()) {
        networkErrorSnackbar.open()
      }
      event.preventDefault()
    })
    addEventListener('update-http-error', (event) => {
      if (!httpErrorSnackbar.isOpen()) {
        httpErrorSnackbar.open()
      }
      event.preventDefault()
    })
    createAppState().then(
      appState => resolveAppStatePromise(appState),
      error => rejectAppStatePromise(error),
    )
  })
</script>

<style>
  .container {
    padding-bottom: var(--snackbar-bottom);
  }
  .container :global(.mdc-snackbar) {
    bottom: var(--snackbar-bottom);
  }
</style>

<div class="container" style="--snackbar-bottom: {snackbarBottom}">
  {#await appStatePromise}
    <h1>Launching...</h1>
  {:then appState}
    {#if appState === undefined }
      <LoginScreen bind:snackbarBottom  />
    {:else}
      <Router app={appState} bind:snackbarBottom />
    {/if}
  {:catch error}
    <h1>{logError(error)}</h1>
  {/await}

  <Snackbar bind:this={authenticationErrorSnackbar} on:MDCSnackbar:closed={handleClosedAuthenticationErrorSnackbar}>
    <Label>An authentication error has occured.</Label>
    <Actions>
      <Button>Login</Button>
      <IconButton class="material-icons" title="Dismiss">close</IconButton>
    </Actions>
  </Snackbar>

  <Snackbar bind:this={networkErrorSnackbar}>
    <Label>A network error has occured.</Label>
    <Actions>
      <IconButton class="material-icons" title="Dismiss">close</IconButton>
    </Actions>
  </Snackbar>

  <Snackbar bind:this={httpErrorSnackbar}>
    <Label>A server error has occured.</Label>
    <Actions>
      <IconButton class="material-icons" title="Dismiss">close</IconButton>
    </Actions>
  </Snackbar>
</div>
