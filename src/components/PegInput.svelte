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
  import CircularProgress from '@smui/circular-progress'

  type PegStatus = {
    amountDivisor: number,
    coinUrl: string,
    unitRate: number,
    debtorData?: DebtorData,
    originalValue?: Peg,
  }

  export let amountDivisor: number = NaN
  export let unit: string = ''
  export let invalid: boolean = false
  export let value : Peg | undefined = undefined

  let originalValue = value
  let pegged: boolean = value !== undefined
  let coinUrl: string = value ? getCoinUrl(value) : ''
  let debtorData: DebtorData | undefined
  let unitRate: number = NaN
  let invalidUnitRate: boolean | undefined

  function getCoinUrl(peg: Peg): string {
    const infoUri = peg.latestDebtorInfo.uri.split('#', 1)[0]
    const debtorUri = peg.debtorIdentity.uri
    return `${infoUri}#${debtorUri}`
  }

  function calcPeg({amountDivisor, coinUrl, unitRate, debtorData, originalValue}: PegStatus): Peg | undefined {
    if (coinUrl !== '') {
      const [debtorInfoUri, debtorUri = ''] = coinUrl.split('#', 2)
      if (debtorData &&
          debtorData.latestDebtorInfo.uri === debtorInfoUri &&
          debtorData.debtorIdentity.uri === debtorUri
         ) {
        return {
          type: 'Peg',
          exchangeRate: (Number(unitRate) * (debtorData.amountDivisor || 1) / (amountDivisor || 1)),
          debtorIdentity: {  type: 'DebtorIdentity', uri: debtorUri },
          latestDebtorInfo: { uri: debtorInfoUri },
        }
      }
    }
    return originalValue
  }

  async function fetchDocument(url: string): Promise<DebtorData | undefined> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), appConfig.serverApiTimeout)
    let response
    try {
      response = await fetch(url, { signal: controller.signal })
    } catch {
      /* ignore */
    }
    clearTimeout(timeoutId)
    if (response && response.status === 200) {
      const contentType = response.headers.get('Content-Type') ?? 'text/plain'
      const content = await response.arrayBuffer()
      try {
        return await parseDebtorInfoDocument({content, contentType})
      } catch (e: unknown) {
        if (!(e instanceof InvalidDocument)) throw e
      }
    }
    return undefined
  }

  async function fetchDebtorData(url: string): Promise<void> {
    url = url.split('#', 1)[0]
    if (url) {
      const data = await fetchDocument(url)
      const [debtorInfoUri, debtorUri = ''] = coinUrl.split('#', 2)
      if (data &&
          data.latestDebtorInfo.uri === debtorInfoUri &&
          data.debtorIdentity.uri === debtorUri
         ) {
        debtorData = data
        unitRate = (
          originalValue
            ? originalValue.exchangeRate * (amountDivisor || 1) / (debtorData.amountDivisor || 1)
            : NaN
        )
      }
    }
  }

  function unpeg(): void {
    pegged = false
  }

  $: status = { amountDivisor, coinUrl, unitRate, debtorData, originalValue }
  $: value = calcPeg(status)
  $: invalid = value !== undefined && Boolean(invalidUnitRate)
  $: showQrScanDialog = pegged && coinUrl === ''
  $: fetchDebtorData(coinUrl)
  $: if (!pegged) {
    coinUrl = ''
    debtorData = undefined
    originalValue = undefined
    invalidUnitRate = undefined
  }
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

<FormField>
  <Switch color="primary" bind:checked={pegged} />
  <span slot="label">
    Set fixed exchange rate between your currency and another currency.
  </span>
</FormField>

<div class:hidden={!pegged} style="margin-top: 16px; height: 10em">
  {#if debtorData}
    <Textfield
      required
      variant="outlined"
      type="number"
      input$min={Number.EPSILON}
      input$step="any"
      style="width: 100%"
      withTrailingIcon={invalidUnitRate}
      bind:value={unitRate}
      bind:invalid={invalidUnitRate}
      label={`The value of one ${unit || "unit"}`}
      suffix={debtorData.unit}
      >
      <svelte:fragment slot="trailingIcon">
        {#if invalidUnitRate}
          <TextfieldIcon class="material-icons">error</TextfieldIcon>
        {/if}
      </svelte:fragment>
      <HelperText slot="helper">
        The value of one unit of your digital currency{unit ? ` (1 ${unit})`: ''},
        represented in the units of the "{debtorData.debtorName}" currency ({debtorData.unit}).
      {#if unit === debtorData.unit} If in doubt, set this to 1.{/if}
        </HelperText>
    </Textfield>
  {:else if coinUrl !== ''}
    <div style="display: flex; align-items: center">
      <div style="margin-right: 1em; color: #c4c4c4">Loading...</div>
      <CircularProgress style="height: 32px; width: 32px;" indeterminate />
    </div>
  {/if}
</div>