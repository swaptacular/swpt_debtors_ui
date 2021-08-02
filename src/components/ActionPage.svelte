<script lang="ts">
  import type { AppState, ActionModel } from '../app-state'
  import CreateTransferAction from './CreateTransferAction.svelte'
  import AbortTransferAction from './AbortTransferAction.svelte'

  export let app: AppState
  export let model: ActionModel

  $: action = model.action
</script>

<button on:click={() => app.showActions()}>Back</button>

{#if action.actionType === 'CreateTransfer'}
  <CreateTransferAction {action} {app} />
{:else if action.actionType === 'AbortTransfer'}
  <AbortTransferAction {action} {app} />
{:else}
  <h1>Unknown Action</h1>
  <dl>
    <dt>actionType:</dt> <dd>{action.actionType}</dd>
    <dt>actionId:</dt> <dd>{action.actionId}</dd>
    <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
  </dl>
{/if}
