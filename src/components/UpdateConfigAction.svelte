<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  let showFailedUpdateDialog = false

  async function save(): Promise<void> {
    await actionUpdater.update(updatedAction)
    await app.executeUpdateConfigAction(updatedAction)
  }

  $: updatedAction = action
  $: actionUpdater = app.createActionUpdater(action, () => { showFailedUpdateDialog = true })
  //$: init(action)
</script>

<h1>Update Config Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>

<button on:click={() => app.dismissUpdateConfigAction(action)}>Dismiss</button>
<button on:click={save}>Save</button>
