<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, ActionModel} from '../app-state'

  export let model: ActionModel
  const action = model.action
  const appState: AppState = getContext('appState')
</script>

<h1>Action Page</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>actionType:</dt> <dd>{action.actionType}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>
<button on:click={() => appState.showActions()}>Back</button>
