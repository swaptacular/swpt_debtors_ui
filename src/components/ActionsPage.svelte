<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, ActionsModel} from '../stores'

  export let page: ActionsModel
  const actions = page.actions
  const appState: AppState = getContext('appState')
</script>

<h1>Actions Page</h1>
<span>{$actions.length}</span>
<button on:click={() => appState.showAction(1)}>Show Action</button>
