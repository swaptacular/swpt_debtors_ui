<script lang="ts">
  import type { AppState, ActionManager } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'
  import type { Peg } from '../debtor-info'
  import Fab, { Icon, Label } from '@smui/fab'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import CharacterCounter from '@smui/textfield/character-counter/index'
  import HelperText from '@smui/textfield/helper-text/index'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import PegInput from './PegInput.svelte'
  import Page from './Page.svelte'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  export const snackbarBottom: string = "84px"

  const homepagePattern = "(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"

  let currentAction: UpdateConfigActionWithId
  let actionManager: ActionManager
  let shakingElement: HTMLElement

  let interestRate: number
  let summary: string
  let debtorName:string
  let debtorHomepageUri: string
  let amountDivisor: number
  let decimalPlaces: number
  let unit: string
  let peg: Peg | undefined

  let invalidCurrencyName: boolean
  let invalidCurrencyAbbreviation: boolean
  let invalidHomepage: boolean
  let invalidInterestRate: boolean
  let invalidAmountDivisor: boolean
  let invalidDecimalPlaces: boolean
  let invalidPeg: boolean

  function createUpdatedAction(): UpdateConfigActionWithId {
    return {
      ...action,
      interestRate: Number(interestRate),
      debtorInfo: {
        summary: summary || undefined,
        debtorName,
        debtorHomepage: debtorHomepageUri ? { uri: `https://${debtorHomepageUri}` } : undefined,
        amountDivisor: Number(amountDivisor),
        decimalPlaces: BigInt(Math.round(Number(decimalPlaces))),
        unit,
        peg,
      }
    }
  }

  function submit(): void {
    if (invalid) {
      if (shakingElement.className === '') {
        shakingElement.className = 'shaking-block'
        setTimeout(() => { shakingElement.className = '' }, 1000)
      }
    } else {
      actionManager.execute()
    }
  }

  function removeHttpsPrefix(url: string = ''): string {
    return url.startsWith('https://') ? url.slice(8) : ''
  }

  $: if (currentAction !== action) {
    currentAction = action
    actionManager = app.createActionManager(action, createUpdatedAction)
    interestRate = action.interestRate ?? 0
    summary = action.debtorInfo?.summary ?? ''
    debtorName = action.debtorInfo?.debtorName ?? ''
    debtorHomepageUri = removeHttpsPrefix(action.debtorInfo?.debtorHomepage?.uri)
    amountDivisor = action.debtorInfo?.amountDivisor ?? 100
    decimalPlaces = Number(action.debtorInfo?.decimalPlaces ?? 2n)
    unit = action.debtorInfo?.unit ?? ''
    peg = action.debtorInfo?.peg
  }
  $: invalid = (
    invalidCurrencyName ||
    invalidCurrencyAbbreviation ||
    invalidHomepage ||
    invalidInterestRate ||
    invalidAmountDivisor ||
    invalidDecimalPlaces ||
    invalidPeg
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
  <Page title="Configure currency">
    <div bind:this={shakingElement} slot="content">
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
              input$maxlength="40"
              bind:invalid={invalidCurrencyName}
              bind:value={debtorName}
              label="Currency name"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidCurrencyName}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                Must be unambiguous, and unlikely to be duplicated
                accidentally.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
            <Textfield
              required
              variant="outlined"
              style="width: 100%"
              input$maxlength="4"
              input$spellcheck="false"
              bind:invalid={invalidCurrencyAbbreviation}
              bind:value={unit}
              label="Currency abbreviation"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidCurrencyAbbreviation}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                This will be shown shown right after the displayed
                amount: "500.00 USD", for example. If your currency
                has a recognized name &ndash; enter its abbreviation
                here. More likely, your currency will be a proxy for a
                well known currency. In that case, use the well know
                abbreviation ("USD" for example).
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
            <Textfield
              variant="outlined"
              style="width: 100%"
              input$maxlength="10000"
              input$pattern={homepagePattern}
              input$spellcheck="false"
              bind:invalid={invalidHomepage}
              bind:value={debtorHomepageUri}
              label="Homepage"
              prefix="https://"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidHomepage}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                A secure web page, where the users of your currency
                can learn more about it (optional).
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
            <Textfield
              textarea
              variant="outlined"
              input$maxlength="1000"
              style="width: 100%"
              bind:value={summary}
              label="Summary"
              >
              <CharacterCounter slot="internalCounter">0 / 1000</CharacterCounter>
              <HelperText slot="helper" persistent>
                A short description of your digital currency
                (optional). Currency holders will see this, when they
                are about to create an account.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
            <Textfield
              required
              variant="outlined"
              type="number"
              input$min="-50"
              input$max="100"
              input$step="any"
              style="width: 100%"
              withTrailingIcon={invalidInterestRate}
              bind:value={interestRate}
              bind:invalid={invalidInterestRate}
              label="Interest rate"
              suffix="%"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidInterestRate}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                The annual rate at which interest accumulates on
                currency holders' accounts. Must be a number between
                -50 and 100. If in doubt, leave it at 0.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 3, tablet: 2, phone: 2 }}>
            <Textfield
              required
              variant="outlined"
              type="number"
              input$min={Number.EPSILON}
              input$step="any"
              style="width: 100%"
              withTrailingIcon={invalidAmountDivisor}
              bind:value={amountDivisor}
              bind:invalid={invalidAmountDivisor}
              label="Amount divisor"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidAmountDivisor}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                To avoid rounding errors, internally, amounts are stored
                as whole numbers. Before being displayed, the whole
                numbers will be divided by this number.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 3, tablet: 2, phone: 2 }}>
            <Textfield
              required
              variant="outlined"
              type="number"
              input$min="-20"
              input$max="20"
              input$step="1"
              style="width: 100%"
              withTrailingIcon={invalidDecimalPlaces}
              bind:value={decimalPlaces}
              bind:invalid={invalidDecimalPlaces}
              label="Decimal places"
              >
              <svelte:fragment slot="trailingIcon">
                {#if invalidDecimalPlaces}
                  <TextfieldIcon class="material-icons">error</TextfieldIcon>
                {/if}
              </svelte:fragment>
              <HelperText slot="helper" persistent>
                The number of digits to show after the decimal point,
                when displaying the amount. Must be a number between -20
                and 20.
              </HelperText>
            </Textfield>
          </Cell>

          <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
            <PegInput {amountDivisor} {unit} bind:value={peg} bind:invalid={invalidPeg} />
          </Cell>
        </LayoutGrid>
      </form>
    </div>

    <svelte:fragment slot="floating">
      <div class="fab-container">
        <Fab on:click={() => actionManager.remove()} extended>
          <Label>Dismiss</Label>
        </Fab>
      </div>
      <div class="fab-container">
        <Fab color="primary" on:click={submit} extended>
          <Icon class="material-icons">storage</Icon>
          <Label>Save</Label>
        </Fab>
      </div>
    </svelte:fragment>
  </Page>
</div>
