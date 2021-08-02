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

<!-- TODO: Show buttons depending on transaction's state. -->
<!-- <button on:click={() => app.deleteCreateTransferAction(action)}>Dismiss</button> -->
<!-- <button on:click={() => app.executeCreateTransferAction(action)}>Send</button> -->
