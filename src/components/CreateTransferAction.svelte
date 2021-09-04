<script lang="ts">
  import type { AppState } from '../app-state'
  import type { CreateTransferActionWithId } from '../operations'
  import { getCreateTransferActionStatus } from '../operations'
  import { generatePayment0TransferNote } from '../payment-requests'
  import Fab, { Icon, Label } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Banner, { Label as BannerLabel } from '@smui/banner'
  import Button from '@smui/button'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'
  import Page from './Page.svelte'

  export let app: AppState
  export let action: CreateTransferActionWithId
  export const snackbarBottom: string = "84px"

  const SEND = "Send"
  const forbidAmountChange = action.requestedAmount > 0
  const deadline = action.requestedDeadline
  const description = action.paymentInfo.description
  let shakingElement: HTMLElement
  let unitAmount: string | number = action.creationRequest.amount ? app.amountToString(action.creationRequest.amount): ''
  let payeeName = action.paymentInfo.payeeName
  let invalidPayeeName: boolean
  let invalidUnitAmount: boolean

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

  $: status = getCreateTransferActionStatus(action)
  $: actionManager = app.createActionManager(action, createUpdatedAction)
  $: executeButtonLabel = (status !== 'Sent' && status !== 'Timed out' && status !== 'Failed') ? SEND : 'Acknowledge'
  $: executeButtonIsHidden = (status === 'Failed')
  $: dismissButtonIsHidden = (status === 'Not confirmed' || status === 'Sent' || status === 'Timed out')
  $: invalid = (
    invalidPayeeName ||
    invalidUnitAmount
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
      {#if deadline && executeButtonLabel === SEND}
        <Banner open>
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
          <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
            <Textfield
              required
              variant="outlined"
              style="width: 100%"
              input$maxlength="200"
              input$spellcheck="false"
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
              disabled={forbidAmountChange}
              input$min={Number.EPSILON}
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

          <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
            {#if description.contentFormat === '.'}
              <p><a href="{description.content}" target="_blank">{description.content}</a></p>
            {:else}
              <p>{description.content}</p>
            {/if}
          </Cell>
        </LayoutGrid>
      </form>
      <h2>{status}</h2>
    </div>

    <svelte:fragment slot="floating">
      {#if !dismissButtonIsHidden}
        <div class="fab-container">
          <Fab on:click={() => actionManager.remove()} extended>
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
