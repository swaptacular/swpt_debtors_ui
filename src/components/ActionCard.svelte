<script lang="ts">
  import { getContext } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import type { ActionRecordWithId } from '../operations'
  import type { AppState } from '../app-state'
  import Button, { Label } from '@smui/button'
  import Card, { Content, Actions } from '@smui/card'

  const app: AppState = getContext('app')
  const debtorConfigData = app.getDebtorConfigData()

  export let action: ActionRecordWithId
  export let show = () => { app.showAction(action.actionId) }
  export let color: string = 'primary'

  function activate(): void {
    app.startInteraction()
    show()
  }

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
    let payeeName
    let unitAmount
    let unit
    switch (action.actionType) {
    case 'CreateTransfer':
      payeeName = action.paymentInfo.payeeName
      unitAmount = app.amountToString(action.creationRequest.amount)
      unit = debtorConfigData.debtorInfo?.unit ?? '\u00a4'
      return `Send ${unitAmount} ${unit} to ${payeeName}.`
    case 'AbortTransfer':
      const transfer = action.transfer
      const title = transfer.result ? "Failed payment" : "Delayed payment"
      payeeName = transfer.paymentInfo.payeeName
      unitAmount = app.amountToString(transfer.amount)
      unit = debtorConfigData.debtorInfo?.unit ?? '\u00a4'
      return `${title}: ${unitAmount} ${unit} to ${payeeName}.`
    case 'UpdateConfig':
      return 'Specify information about your currency.'
    default:
      return 'Unknown action type'
    }
  }
</script>

<div in:fly|local="{{ x: -350, duration: 1000 }}" out:fade|local="{{ duration: 1000 }}">
  <Card>
    <Content>{getDescription(action)}</Content>
    <Actions fullBleed>
      <Button {color} on:click={activate}>
        <Label>{getButtonLabel(action)}</Label>
        <i class="material-icons" aria-hidden="true">arrow_forward</i>
      </Button>
    </Actions>
  </Card>
</div>
