<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'
  import Fab, { Icon, Label } from '@smui/fab';
  import Textfield from '@smui/textfield'
  import CharacterCounter from '@smui/textfield/character-counter/index'
  import HelperText from '@smui/textfield/helper-text/index'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Page from './Page.svelte'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  export const snackbarBottom: string = "84px"

  let interestRate = action.interestRate ?? 0
  let summary = action.debtorInfo?.summary ?? ''
  let debtorName = action.debtorInfo?.debtorName ?? ''
  let debtorHomepageUri = action.debtorInfo?.debtorHomepage?.uri ?? ''
  let amountDivisor = action.debtorInfo?.amountDivisor ?? 100
  let decimalPlaces = action.debtorInfo?.decimalPlaces ?? 2
  let unit = action.debtorInfo?.unit ?? ''
  let peg = action.debtorInfo?.peg

  function createUpdatedAction(): UpdateConfigActionWithId {
    return {
      ...action,
      interestRate,
      debtorInfo: {
        summary: summary || undefined,
        debtorName,
        debtorHomepage: debtorHomepageUri ? { uri: debtorHomepageUri } : undefined,
        amountDivisor: amountDivisor | Number.EPSILON,
        decimalPlaces: Math.round(decimalPlaces),
        unit,
        peg,
      }
    }
  }

  $: actionManager = app.createActionManager(action, createUpdatedAction)
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Configure currency">
  <svelte:fragment slot="content">
    <form
      noValidate
      autoComplete="off"
      on:input={() => actionManager.markDirty()}
      on:change={() => actionManager.save()}
      >

      <LayoutGrid>
        <Cell>
          <Textfield required variant="outlined" style="width: 100%" bind:value={debtorName} label="Name">
            <HelperText slot="helper">Helper Text</HelperText>
          </Textfield>
        </Cell>

        <Cell>
          <Textfield
            required
            variant="outlined"
            style="width: 100%"
            input$maxlength="40"
            bind:value={unit}
            label="Abbreviation"
            >
            <HelperText slot="helper">
              This will be shown shown right after the displayed
              amount: "500.00 USD" for example. If your digital
              currency has a recognized name &ndash; enter its
              abbreviation here. More likely, your currency will be a
              proxy for a well known currency. In that case, use the
              well know abbreviation (in this example: "USD").
            </HelperText>
          </Textfield>
        </Cell>

        <Cell span={8}>
          <Textfield variant="outlined" style="width: 100%" bind:value={debtorHomepageUri} label="Homepage">
            <HelperText slot="helper">
              An Internet address, where the users of your currency
              can learn more about it.
            </HelperText>
          </Textfield>
        </Cell>

        <Cell span={12}>
          <Textfield
            textarea
            variant="outlined"
            input$maxlength="1000"
            style="width: 100%"
            bind:value={summary}
            label="Summary"
            >
            <CharacterCounter slot="internalCounter">0 / 1000</CharacterCounter>
            <HelperText slot="helper">
              A short description of your digital currency. Should
              contain just enough information to...
            </HelperText>
          </Textfield>
        </Cell>

        <Cell span={2}>
          <Textfield
            required
            type="number"
            input$min={Number.EPSILON}
            input$step="any"
            variant="outlined"
            style="width: 100%"
            bind:value={amountDivisor}
            label="Amount divisor"
            >
            <HelperText slot="helper">
              To avoid rounding errors, internally amounts are stored
              as whole numbers. Before being displayed, the whole
              numbers will be divided by this number.
            </HelperText>
          </Textfield>
        </Cell>

        <Cell span={2}>
          <Textfield
            required
            type="number"
            input$min="-20"
            input$max="20"
            input$step="1"
            variant="outlined"
            style="width: 100%"
            bind:value={decimalPlaces}
            label="Decimal places"
            >
            <HelperText slot="helper">
              The number of digits to show after the decimal point,
              when displaying the amount. This must be a number
              between -20 and 20.
            </HelperText>
          </Textfield>
        </Cell>

        <Cell>
          <Textfield
            required
            type="number"
            input$min="-50"
            input$max="100"
            input$step="any"
            variant="outlined"
            style="width: 100%"
            bind:value={interestRate}
            label="Interest rate"
            >
            <HelperText slot="helper">
              The annual rate (in percents) at which interest
              accumulates on currency holders' accounts. This can be
              any number between -50 and 100. If in doubt, leave it at
              0.
            </HelperText>
          </Textfield>
        </Cell>
      </LayoutGrid>

      <!-- <p><label>interestRate:<input required type=number bind:value={interestRate}></label></p> -->
      <!-- <p><label>debtorName:<input required minlength="1" maxlength="40" bind:value={debtorName}></label></p> -->
      <!-- <p><label>summary:<textarea bind:value={summary} maxlength="1000"></textarea></label></p> -->
      <!-- <p><label>debtorHomepage:<input maxlength="10000" bind:value={debtorHomepageUri}></label></p> -->
      <!-- <p><label>amountDivisor:<input required type=number min="0" bind:value={amountDivisor}></label></p> -->
      <!-- <p><label>decimalPlaces:<input required type=number min="-20" max="20" step="1" bind:value={decimalPlaces}></label></p> -->
      <!-- <p><label>unit:<input required minlength="1" maxlength="40" bind:value={unit}></label></p> -->
    </form>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={() => actionManager.remove()} extended>
        <Label>Dismiss</Label>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab color="primary" on:click={() => actionManager.execute()} extended>
        <Icon class="material-icons">save</Icon>
        <Label>Save</Label>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
