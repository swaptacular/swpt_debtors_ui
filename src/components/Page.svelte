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
  import Alerts from './Alerts.svelte'
  import Hourglass from './Hourglass.svelte'

  export let title: string

  const app: AppState = getContext('app')
  const { waitingInteractions, alerts, pageModel } = app
  const unauthenticated: Writable<boolean> = getContext('unauthenticated')
  let topAppBar: any

  function confirmLogout() {
    if (confirm('You will be logged out. To use the application again, you will have to log in.')) {
      logout()
    }
  }
  async function update(): Promise<void> {
    await app.fetchDataFromServer()
    $pageModel.reload()
  }
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
  }
</style>

<TopAppBar dense bind:this={topAppBar}>
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
</AutoAdjust>
