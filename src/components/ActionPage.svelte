<script lang="ts">
  import type { AppState, ActionModel } from '../app-state'
  import CreateTransferAction from './CreateTransferAction.svelte'
  import AbortTransferAction from './AbortTransferAction.svelte'
  import UpdateConfigAction from './UpdateConfigAction.svelte'

  export let app: AppState
  export let model: ActionModel
  export let snackbarBottom: string = '0px'

  $: action = model.action
</script>

{#if action.actionType === 'CreateTransfer'}
  <CreateTransferAction {action} {app} bind:snackbarBottom />
{:else if action.actionType === 'AbortTransfer'}
  <AbortTransferAction {action} {app} bind:snackbarBottom />
{:else if action.actionType === 'UpdateConfig'}
  <UpdateConfigAction {action} {app} bind:snackbarBottom />
{/if}
