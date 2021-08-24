<script lang="ts">
  import { getContext } from 'svelte'
  import type { ActionRecordWithId } from '../operations'
  import type { AppState } from '../app-state'
  import Button, { Label } from '@smui/button'
  import Card, { Content, Actions } from '@smui/card'

  const app: AppState = getContext('app')

  export let action: ActionRecordWithId
  export let show = () => { app.showAction(action.actionId) }
  export let color: string = 'primary'

  function getButtonLabel(action: ActionRecordWithId): string {
    switch (action.actionType) {
    case 'CreateTransfer':
      return 'Make payment'
    case 'AbortTransfer':
      return 'Show the problem'
    case 'UpdateConfig':
      return 'Update configuration'
    default:
      return 'Unknown action type'
    }
  }
</script>

<Card>
  <Content>{action.actionType}</Content>
  <Actions fullBleed>
    <Button {color} on:click={show}>
      <Label>{getButtonLabel(action)}</Label>
      <i class="material-icons" aria-hidden="true">arrow_forward</i>
    </Button>
  </Actions>
</Card>
