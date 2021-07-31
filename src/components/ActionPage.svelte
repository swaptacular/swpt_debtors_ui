<script lang="ts">
  import type { AppState, ActionModel } from '../app-state'

  export let app: AppState
  export let model: ActionModel
  $: action = model.action
</script>

<h1>Action Page</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>actionType:</dt> <dd>{action.actionType}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>
<button on:click={() => app.showActions()}>Back</button>
