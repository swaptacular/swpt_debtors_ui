<script lang="ts">
  import type { Peg, DebtorData } from '../debtor-info'
  import { parseDebtorInfoDocument, InvalidDocument } from '../debtor-info'
  import Switch from '@smui/switch'
  import FormField from '@smui/form-field'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'
  import Dialog, { Title, Content, Actions } from '@smui/dialog'
  import QrScanner from './QrScanner.svelte'
  import Button, { Label } from '@smui/button'

  export let amountDivisor: number = NaN
  export let unit: string = ''
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

  async function fetchDebtorInfo(coinUrl: string): Promise<DebtorData> {
    if (coinUrl.split('#', 1)[0] === '') {
      throw new InvalidDocument('empty URL')
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), appConfig.serverApiTimeout)
    const response = await fetch(coinUrl, { signal: controller.signal })
    clearTimeout(timeoutId);
    if (response.status !== 200) {
      throw new InvalidDocument('server error')
    }
    const contentType = response.headers.get('Content-Type') ?? 'text/plain'
    const content = await response.arrayBuffer()
    return await parseDebtorInfoDocument({content, contentType})
  }

  function unpeg(): void {
    pegged = false
  }

  $: invalid = pegged && (invalidCoinUrl || invalidExchangeRate)
  $: value = pegged ? getPeg(coinUrl, exchangeRate) : undefined
  $: if (!pegged) {
    reset()
  }
  $: showQrScanDialog = pegged && coinUrl === ''
  $: debtorDataPromise = fetchDebtorInfo(coinUrl)

  // TODO: Dispatch onChange event when information has changed.
</script>

<style>
  .hidden {
    visibility: hidden;
  }
</style>

{#if showQrScanDialog}
  <Dialog
    open
    scrimClickAction=""
    escapeKeyAction=""
    aria-labelledby="qrscan-title"
    aria-describedby="qrscan-content"
    on:MDCDialog:closed={unpeg}
    >
    <Title id="qrscan-title">Scan another currency's digital coin (a QR code)</Title>
    <Content id="qrscan-content">
      <QrScanner bind:result={coinUrl}/>
    </Content>
    <Actions>
      <Button type="button">
        <Label>Close</Label>
      </Button>
    </Actions>
  </Dialog>
{/if}

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
      {#await debtorDataPromise}
        waiting
      {:then debtorData}
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
          label={`The value of one ${unit || "unit"}`}
          suffix={debtorData.unit}
          >
          <svelte:fragment slot="trailingIcon">
            {#if invalidExchangeRate}
              <TextfieldIcon class="material-icons">error</TextfieldIcon>
            {/if}
          </svelte:fragment>
          <HelperText slot="helper">
            The value of one unit of your digital currency{unit ? ` (1 ${unit})`: ''},
            expressed in the units of the other currency ({debtorData.unit}).
            {#if unit === debtorData.unit} If in doubt, set this to 1.{/if}
          </HelperText>
        </Textfield>
      {:catch}
        error
      {/await}
    </div>
  </Cell>
</LayoutGrid>

{coinUrl}
