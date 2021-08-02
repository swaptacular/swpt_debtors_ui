<script lang="ts">
  import type { AppState, ActionModel } from '../app-state'
  import CreateTransferAction from './CreateTransferAction.svelte'

  export let app: AppState
  export let model: ActionModel

  $: action = model.action
</script>

{#if action.actionType === 'CreateTransfer'}
  <CreateTransferAction {action} {app} />
{:else}
  <h1>Action</h1>
  <dl>
    <dt>actionType:</dt> <dd>{action.actionType}</dd>
    <dt>actionId:</dt> <dd>{action.actionId}</dd>
    <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
  </dl>
{/if}
<button on:click={() => app.showActions()}>Back</button>
