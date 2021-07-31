<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, ActionModel} from '../stores'

  export let page: ActionModel
  const action = page.action
  const appState: AppState = getContext('appState')
</script>

<h1>Action Page</h1>
<dl>
  <dt>actionId:</dt> <dd>{action.actionId}</dd>
  <dt>actionType:</dt> <dd>{action.actionType}</dd>
  <dt>createdAt:</dt> <dd>{action.createdAt.toISOString()}</dd>
</dl>
<button on:click={() => appState.showActions()}>Back</button>
