<script lang="ts">
  import type { Peg } from '../debtor-info'
  import Switch from '@smui/switch'
  import FormField from '@smui/form-field'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'

  export let invalid = false
  export let value : Peg | undefined = undefined

  let pegged: boolean = value !== undefined
  let coinUrl: string = value ? getCoinUrl(value) : ''
  let exchangeRate: number = value ? value.exchangeRate : 0
  let invalidCoinUrl: boolean
  let invalidExchangeRate: boolean

  function getCoinUrl(peg: Peg): string {
    const infoUri = peg.latestDebtorInfo.uri.split('#', 1)[0]
    const debtorUri = peg.debtorIdentity.uri
    return `${infoUri}#${debtorUri}`
  }

  function getPeg(coinUrl: string, exchangeRate: number): Peg {
    const [debtorInfoUri = '', debtorUri = ''] = coinUrl.split('#', 2)
    return {
      type: 'Peg',
      exchangeRate,
      debtorIdentity: {  type: 'DebtorIdentity', uri: debtorUri },
      latestDebtorInfo: { uri: debtorInfoUri },
    }
  }

  function reset(): void {
    value = undefined
    coinUrl = ''
    exchangeRate = 0
  }

  $: invalid = pegged && (invalidCoinUrl || invalidExchangeRate)
  $: value = pegged ? getPeg(coinUrl, exchangeRate) : undefined
  $: if (!pegged) {
    reset()
  }
</script>

<style>
  .hidden {
    visibility: hidden;
  }
</style>

<LayoutGrid>
  <Cell>
    <FormField>
      <Switch color="primary" bind:checked={pegged} />
      <span slot="label">
        Set fixed exchange rate between your currency and another currency.
      </span>
    </FormField>
  </Cell>
  <Cell>
    <div class:hidden={!pegged}>
      <Textfield
        required
        variant="outlined"
        type="number"
        input$min={Number.EPSILON}
        input$step="any"
        style="width: 100%"
        withTrailingIcon={invalidExchangeRate}
        bind:value={exchangeRate}
        bind:invalid={invalidExchangeRate}
        label="Exchange rate"
        >
        <svelte:fragment slot="trailingIcon">
          {#if invalidExchangeRate}
            <TextfieldIcon class="material-icons">error</TextfieldIcon>
          {/if}
        </svelte:fragment>
        <HelperText slot="helper">
          For example, 2.0 would mean that your currency's
          tokens are twice as valuable as other currency's
          tokens.
        </HelperText>
      </Textfield>
    </div>
  </Cell>
</LayoutGrid>
