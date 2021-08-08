<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'

  export let app: AppState
  export let action: UpdateConfigActionWithId

  // TODO: call this on change, and when leaving the page.
  function save() {
    actionManager.save(updatedAction)
  }
  function execute() {
    save()
    actionManager.execute()
  }
  function dismiss() {
    actionManager.remove()
  }

  $: updatedAction = action
  $: actionManager = app.createActionManager(action)
</script>

<h1>Update Config Action</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>createdAt:</dt> <dd>{new Date(action.time).toISOString()}</dd>
</dl>

<button on:click={dismiss}>Dismiss</button>
<button on:click={execute}>Save</button>
