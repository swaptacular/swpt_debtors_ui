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
  export let invalid: boolean = false
  export let value : Peg | undefined = undefined

  let originalValue = value
  let pegged: boolean = value !== undefined
  let coinUrl: string = value ? getCoinUrl(value) : ''
  let unitValue: number = 0
  let debtorData: DebtorData | undefined
  let invalidUnitValue: boolean

  function getCoinUrl(peg: Peg): string {
    const infoUri = peg.latestDebtorInfo.uri.split('#', 1)[0]
    const debtorUri = peg.debtorIdentity.uri
    return `${infoUri}#${debtorUri}`
  }

  function calcPeg(
    coinUrl: string,
    unitValue: number,
    amountDivisor: number,
    debtorData?: DebtorData,
    originalValue?: Peg,
  ): Peg | undefined {
    if (coinUrl === '') {
      return undefined
    }
    const [debtorInfoUri = '', debtorUri = ''] = coinUrl.split('#', 2)
    if (
      debtorData &&
      debtorData.latestDebtorInfo.uri === debtorInfoUri &&
      debtorData.debtorIdentity.uri === debtorUri
    ) {
      const uv = typeof unitValue === 'number' ? unitValue : 0
      return {
        type: 'Peg',
        exchangeRate: (uv * (amountDivisor || 1) / (debtorData.amountDivisor || 1)),
        debtorIdentity: {  type: 'DebtorIdentity', uri: debtorUri },
        latestDebtorInfo: { uri: debtorInfoUri },
      }
    }
    return originalValue
  }

  async function fetchDocument(url: string): Promise<DebtorData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), appConfig.serverApiTimeout)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId);
    if (response.status !== 200) {
      throw new InvalidDocument('server error')
    }
    const contentType = response.headers.get('Content-Type') ?? 'text/plain'
    const content = await response.arrayBuffer()
    return await parseDebtorInfoDocument({content, contentType})
  }

  async function fetchDebtorData(coinUrl: string): Promise<void> {
    const url = coinUrl.split('#', 1)[0]
    if (url) {
      try {
        debtorData = await fetchDocument(url)
        unitValue = originalValue ? originalValue.exchangeRate * (debtorData.amountDivisor || 1) / (amountDivisor || 1) : 0
      } catch (e: unknown) {
        throw e
        // reset()
      }
    }
  }

  function unpeg(): void {
    pegged = false
  }

  $: value = calcPeg(coinUrl, unitValue, amountDivisor, debtorData, originalValue)
  $: invalid = value !== undefined && invalidUnitValue
  $: if (!pegged) {
    coinUrl = ''
    unitValue = 0
    originalValue = undefined
  }
  $: showQrScanDialog = pegged && coinUrl === ''
  $: fetchDebtorData(coinUrl)

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
      <!-- The type="button" is necessary to prevent form submitting.-->
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
      {#if debtorData}
        <Textfield
          required
          variant="outlined"
          type="number"
          input$min={Number.EPSILON}
          input$step="any"
          style="width: 100%"
          withTrailingIcon={invalidUnitValue}
          bind:value={unitValue}
          bind:invalid={invalidUnitValue}
          label={`The value of one ${unit || "unit"}`}
          suffix={debtorData.unit}
          >
          <svelte:fragment slot="trailingIcon">
            {#if invalidUnitValue}
              <TextfieldIcon class="material-icons">error</TextfieldIcon>
            {/if}
          </svelte:fragment>
          <HelperText slot="helper">
            The value of one unit of your digital currency{unit ? ` (1 ${unit})`: ''},
            represented in the units of the "{debtorData.debtorName}" currency ({debtorData.unit}).
            {#if unit === debtorData.unit} If in doubt, set this to 1.{/if}
          </HelperText>
        </Textfield>
      {/if}
    </div>
  </Cell>
</LayoutGrid>

{coinUrl}
{value}
