<script lang="ts">
  import type { AppState } from '../app-state'
  import type { AbortTransferActionWithId } from '../operations'

  export let app: AppState
  export let action: AbortTransferActionWithId
</script>

<h1>Abort Transfer Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

<!-- TODO: Show a cancel button for delayed transfers instead. -->
<button on:click={() => app.dismissTransfer(action)}>Dismiss</button>
