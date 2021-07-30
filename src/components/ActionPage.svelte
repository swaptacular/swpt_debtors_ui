<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, ActionModel} from '../stores'

  export let page: ActionModel
  const action = page.action
  const appState: AppState = getContext('appState')
</script>

<h1>Action Page</h1>
<span>{$action}</span>
<button on:click={() => appState.showActions()}>Back</button>
