<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import { onMount, getContext, tick } from 'svelte'
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
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'

  export let title: string
  export let scrollTop: number | undefined = undefined
  export let scrollLeft: number | undefined = undefined

  const app: AppState = getContext('app')
  const { waitingInteractions, alerts, pageModel } = app
  const authenticated: Writable<boolean> = getContext('authenticated')
  let topAppBar: any

  function goHome() {
    app.startInteraction()
    app.showActions()
  }

  function confirmLogout() {
    app.startInteraction()
    if (confirm('You will be logged out. To use the application again, you will have to log in.')) {
      logout()
    }
  }

  function update(): void {
    app.startInteraction()
    app.fetchDataFromServer(() => $pageModel.reload())
  }

  function goBack(): void {
    app.startInteraction()
    $pageModel.goBack?.()
  }

  onMount(async () => {
    await tick()
    document.documentElement.scrollTop = scrollTop ?? 0
    document.documentElement.scrollLeft = scrollLeft ?? 0
  })
</script>

<style>
  /* Hide everything above this component. */
  :global(body, html) {
    display: block !important;
    height: auto !important;
    width: auto !important;
    position: static !important;
  }
  .floating {
    display: flex;
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100%;
    justify-content: center;
    pointer-events: none;
  }
  .floating :global(*) {
    pointer-events: auto;
  }
</style>

<div in:fly="{{ x: 250, duration: 200 }}">
  <TopAppBar variant="fixed" dense bind:this={topAppBar}>
    <Row>
      <Section>
        {#if $pageModel.goBack}
          <IconButton class="material-icons" on:click={goBack}>
            arrow_back
          </IconButton>
        {/if}
        <Title>{title}</Title>
      </Section>

      <Section align="end" toolbar>
        <IconButton class="material-icons" aria-label="Reload" on:click={update}>
          {#if $authenticated}
            sync
          {:else}
            sync_problem
          {/if}
        </IconButton>

        {#if $pageModel.goBack}
          <IconButton class="material-icons" aria-label="Logout" on:click={goHome}>
            home
          </IconButton>
        {:else}
          <IconButton class="material-icons" aria-label="Logout" on:click={confirmLogout}>
            logout
          </IconButton>
        {/if}
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

    <div class="floating" in:fade="{{ duration: 300, delay: 280 }}">
      <slot name="floating"></slot>
    </div>
  </AutoAdjust>
</div>
