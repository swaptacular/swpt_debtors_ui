<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'

  export let app: AppState
  export let action: UpdateConfigActionWithId
</script>

<h1>Update Config Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

<button on:click={() => app.deleteUpdateConfigAction(action)}>Dismiss</button>
<button on:click={() => app.executeUpdateConfigAction(action)}>Save</button>
