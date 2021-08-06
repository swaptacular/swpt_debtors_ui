<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  let showFailedUpdateDialog = false

  async function execute(): Promise<void> {
    await saveAction(updatedAction)
    await app.executeUpdateConfigAction(updatedAction)
  }
  async function dismiss(): Promise<void> {
    await saveAction(updatedAction)
    await app.dismissUpdateConfigAction(updatedAction)
  }

  $: updatedAction = action
  $: saveAction = app.createActionUpdater(action, () => { showFailedUpdateDialog = true })
</script>

<h1>Update Config Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

<button on:click={dismiss}>Dismiss</button>
<button on:click={execute}>Save</button>
