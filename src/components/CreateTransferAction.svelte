<script lang="ts">
  import type { AppState } from '../app-state'
  import type { CreateTransferActionWithId } from '../operations'
  import { getCreateTransferActionStatus } from '../operations'

  export let app: AppState
  export let action: CreateTransferActionWithId

  $: status = getCreateTransferActionStatus(action)
</script>

<h1>Create Transfer Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{new Date(action.time).toISOString()}</dd>
  <dt>amount:</dt> <dd>{action.creationRequest.amount}</dd>
  <dt>payeeName:</dt> <dd>{action.paymentInfo.payeeName}</dd>
  <dt>descriptionFormat:</dt> <dd>{action.paymentInfo.description.contentFormat}</dd>
  <dt>description:</dt> <dd>{action.paymentInfo.description.content}</dd>
  <dt>status:</dt> <dd>{status}</dd>
</dl>

<!-- TODO: Change the buttons depending on the `status`. -->
<button on:click={() => app.dismissCreateTransferAction(action)}>Dismiss</button>
<button on:click={() => app.executeCreateTransferAction(action)}>Send</button>
