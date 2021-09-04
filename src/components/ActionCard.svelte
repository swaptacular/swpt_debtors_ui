<script lang="ts">
  import { getContext } from 'svelte'
  import type { ActionRecordWithId } from '../operations'
  import type { AppState } from '../app-state'
  import Button, { Label } from '@smui/button'
  import Card, { Content, Actions } from '@smui/card'

  const app: AppState = getContext('app')
  const debtorConfigData = app.getDebtorConfigData()

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
      return 'Configure currency'
    default:
      return 'Unknown action type'
    }
  }

  function getDescription(action: ActionRecordWithId): string {
    switch (action.actionType) {
    case 'CreateTransfer':
      const payeeName = action.paymentInfo.payeeName
      const unitAmount = app.amountToString(action.creationRequest.amount)
      const unit = debtorConfigData.debtorInfo?.unit ?? '\u00a4'
      return `Send ${unitAmount} ${unit} to ${payeeName}.`
    case 'AbortTransfer':
      return 'AbortTransfer'
    case 'UpdateConfig':
      return 'Specify information about your currency.'
    default:
      return 'Unknown action type'
    }
  }
</script>

<Card>
  <Content>{getDescription(action)}</Content>
  <Actions fullBleed>
    <Button {color} on:click={show}>
      <Label>{getButtonLabel(action)}</Label>
      <i class="material-icons" aria-hidden="true">arrow_forward</i>
    </Button>
  </Actions>
</Card>
