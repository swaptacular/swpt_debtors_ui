<script lang="ts">
  import { INVALID_REQUEST_MESSAGE } from '../app-state'
  import type { AppState, ActionManager } from '../app-state'
  import type { CreateTransferActionWithId, CreateTransferActionStatus } from '../operations'
  import { getCreateTransferActionStatus } from '../operations'
  import { generatePayment0TransferNote } from '../payment-requests'
  import Paper, { Title, Content } from '@smui/paper'
  import Fab, { Icon, Label } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Banner, { Label as BannerLabel } from '@smui/banner'
  import Button from '@smui/button'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'
  import Chip, { Text } from '@smui/chips'
  import Tooltip, { Wrapper } from '@smui/tooltip'
  import Page from './Page.svelte'

  export let app: AppState
  export let action: CreateTransferActionWithId
  export const snackbarBottom: string = "84px"

  const maxUnitAmount =  Number(app.amountToString(2n ** 63n - 1000000n))
  let shakingElement: HTMLElement
  let currentAction: CreateTransferActionWithId
  let actionManager: ActionManager

  let payeeName: string
  let unitAmount: string | number

  let invalidPayeeName: boolean | undefined
  let invalidUnitAmount: boolean | undefined
  let activeBanner: boolean

  function createUpdatedAction(): CreateTransferActionWithId {
    const paymentInfo = {
      ...action.paymentInfo,
      payeeName,
    }
    return {
      ...action,
      paymentInfo,
      creationRequest: {
        ...action.creationRequest,
        amount: app.stringToAmount(unitAmount),
        noteFormat: action.requestedAmount ? 'PAYMENT0' : 'payment0',
        note: generatePayment0TransferNote(paymentInfo, app.noteMaxBytes),
      },
    }
  }

  function getInfoTooltip(status: CreateTransferActionStatus): string {
    switch (status) {
    case 'Draft':
      return 'No attempts to transfer the amount have been made yet.'
    case 'Not sent':
      return 'An attempt has been made to transfer the amount, '
        + 'but it was unsuccessful. '
        + 'It is safe to retry the transfer, though.'
    case 'Not confirmed':
      return 'An attempt has been made to transfer the amount, '
        + 'but it is unknown whether the amount was successfully transferred or not. '
        + 'It is safe to retry the transfer, though.'
    case 'Sent':
      return 'The amount was successfully transferred.'
    case 'Failed':
      return INVALID_REQUEST_MESSAGE
    case 'Timed out':
      return 'An attempt has been made to transfer the amount, '
        + 'but it is unknown whether the amount has been successfully transferred or not. '
        + 'It is not safe to retry the transfer.'
    }
  }

  function execute(): void {
    if (invalid) {
      if (shakingElement.className === '') {
        shakingElement.className = 'shaking-block'
        setTimeout(() => { shakingElement.className = '' }, 1000)
      }
    } else {
      actionManager.execute()
    }
  }

  $: if (currentAction !== action) {
    currentAction = action
    actionManager = app.createActionManager(action, createUpdatedAction)
    payeeName = action.paymentInfo.payeeName
    unitAmount = action.creationRequest.amount ? app.amountToString(action.creationRequest.amount): ''
    invalidPayeeName = undefined
    invalidUnitAmount = undefined
    activeBanner = true
  }
  $: forbidAmountChange = action.requestedAmount > 0
  $: deadline = action.requestedDeadline
  $: description = action.paymentInfo.description
  $: status = getCreateTransferActionStatus(action)
  $: forbidChange = status !== 'Draft'
  $: executeButtonLabel = (status !== 'Sent' && status !== 'Timed out' && status !== 'Failed') ? "Send" : 'Acknowledge'
  $: executeButtonIsHidden = (status === 'Failed')
  $: dismissButtonIsHidden = (status === 'Not confirmed' || status === 'Sent' || status === 'Timed out')
  $: showDeadlineWarning = activeBanner && deadline !== undefined && status === "Draft"
  $: title = status === 'Draft' ? 'Payment request' : `${status} payment`
  $: tooltip = getInfoTooltip(status)
  $: invalid = (
    invalidPayeeName ||
    invalidUnitAmount ||
    showDeadlineWarning
  )
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
  .shaking-container {
    position: relative;
    overflow: hidden;
  }

  @keyframes shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }

  :global(.shaking-block) {
    animation: shake 0.5s;
    animation-iteration-count: 1;
  }
</style>

<div class="shaking-container">
  <Page title="Payment">
    <div bind:this={shakingElement} slot="content">
      {#if showDeadlineWarning && deadline !== undefined}
        <Banner bind:open={activeBanner} mobileStacked centered>
          <BannerLabel slot="label">
            The payment request specifies {deadline.toLocaleString()}
            as deadline for the payment. When issuing money into
            existence, payment deadlines are not supported, and will
            be ignored.
          </BannerLabel>
          <svelte:fragment slot="actions">
            <Button>OK</Button>
          </svelte:fragment>
        </Banner>
      {/if}

      <form
        noValidate
        autoComplete="off"
        on:input={() => actionManager.markDirty()}
        on:change={() => actionManager.save()}
        >
        <LayoutGrid>
          <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
            <Wrapper>
              <Paper style="margin-top: 16px; margin-bottom: 28px" elevation={4}>
                <Title style="display: flex; justify-content: space-between; align-items: center">
                  {title}
                  <Chip chip="help" on:click={() => undefined}>
                    <Text tabindex="0">info</Text>
                  </Chip>
                  <Tooltip>{tooltip}</Tooltip>
                </Title>
                <Content>
                  {#if description.contentFormat === '.'}
                    <a href="{description.content}" target="_blank">{description.content}</a>
                  {:else if description.content}
                    {description.content}
                  {:else}
                    <span style="color: #c4c4c4">The payment request does not contain a description.</span>
                  {/if}
                </Content>
              </Paper>
            </Wrapper>
          </Cell>

          <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
            <Textfield
              required
              variant="outlined"
              style="width: 100%"
              input$maxlength="200"
              input$spellcheck="false"
              disabled={forbidChange}
              bind:invalid={invalidPayeeName}
              bind:value={payeeName}
              label="Payee name"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidPayeeName}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper">
                The name of the recipient of the payment.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
            <Textfield
              required
              variant="outlined"
              type="number"
              disabled={forbidChange || forbidAmountChange}
              input$min={Number.EPSILON}
              input$max={maxUnitAmount}
              input$step="any"
              style="width: 100%"
              withTrailingIcon={invalidUnitAmount}
              bind:value={unitAmount}
              bind:invalid={invalidUnitAmount}
              label="Amount"
              suffix={app.unit}
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidUnitAmount}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper">
                The amount that will be transferred to the payee.
              </HelperText>
            </Textfield>
          </Cell>
        </LayoutGrid>
      </form>
    </div>

    <svelte:fragment slot="floating">
      {#if !dismissButtonIsHidden}
        <div class="fab-container">
          <Fab color={executeButtonIsHidden ? "primary" : "secondary"} on:click={() => actionManager.remove()} extended>
            <Label>Dismiss</Label>
          </Fab>
        </div>
      {/if}
      {#if !executeButtonIsHidden}
        <div class="fab-container">
          <Fab color="primary" on:click={execute} extended>
            <Icon class="material-icons">monetization_on</Icon>
            <Label>{executeButtonLabel}</Label>
          </Fab>
        </div>
      {/if}
    </svelte:fragment>
  </Page>
</div>
