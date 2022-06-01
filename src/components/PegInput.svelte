<script lang="ts">
  import { getContext } from 'svelte'
  import { Alert } from '../app-state'
  import type { AppState } from '../app-state'
  import type { Peg, DebtorData } from '../debtor-info'
  import { DEFAULT_PEG_COIN, DEFAULT_PEG_ABBR } from '../app-state'
  import { parseDebtorInfoDocument, InvalidDocument } from '../debtor-info'
  import { tick, createEventDispatcher } from 'svelte'
  import Switch from '@smui/switch'
  import FormField from '@smui/form-field'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'
  import { Title, Content, Actions, InitialFocus } from '@smui/dialog'
  import Dialog from './Dialog.svelte'
  import QrScanner from './QrScanner.svelte'
  import Button, { Label } from '@smui/button'
  import CircularProgress from '@smui/circular-progress'

  type PegStatus = {
    amountDivisor: number,
    coinUrl: string,
    unitRate: unknown,
    debtorData?: DebtorData,
    unchangedValue?: Peg,
  }

  export let amountDivisor: number = NaN
  export let unit: string = ''
  export let invalid: boolean = false
  export let value : Peg | undefined = undefined

  const dispatch = createEventDispatcher()
  const app: AppState = getContext('app')
  let currentValue: Peg | undefined | null = null

  // Stores the peg value received from the parent component. When the
  // user switches the peg off, it becomes `undefined`.
  let unchangedValue: Peg | undefined

  let loadingError: boolean
  let hasFlash: boolean
  let flashlightOn: boolean
  let showQrScanDialog: boolean
  let pegged: boolean
  let coinUrl: string
  let debtorData: DebtorData | undefined
  let unitRate: unknown
  let invalidUnitRate: boolean | undefined

  const LOADING_ERROR = (
    "Can not load information about the currency to which your " +
    "currency is pegged. Please check your network connection."
  )

  function toggleFlashlight() {
    flashlightOn = !flashlightOn
  }

  function getCoinUrl(peg: Peg): string {
    const infoUri = peg.latestDebtorInfo.uri.split('#', 1)[0]
    const debtorUri = peg.debtorIdentity.uri
    return `${infoUri}#${debtorUri}`
  }

  function calcPeg({amountDivisor, coinUrl, unitRate, debtorData, unchangedValue}: PegStatus): Peg | undefined {
    if (coinUrl !== '') {
      const [debtorInfoUri, debtorUri = ''] = coinUrl.split('#', 2)
      if (debtorData &&
          debtorData.latestDebtorInfo.uri === debtorInfoUri &&
          debtorData.debtorIdentity.uri === debtorUri
         ) {
        return {
          type: 'Peg',
          exchangeRate: (Number(unitRate) * debtorData.amountDivisor / (amountDivisor || 1)),
          debtorIdentity: {  type: 'DebtorIdentity', uri: debtorUri },
          latestDebtorInfo: { uri: debtorInfoUri },
          display: {
            type: 'PegDisplay',
            amountDivisor: debtorData.amountDivisor,
            decimalPlaces: debtorData.decimalPlaces,
            unit: debtorData.unit,
          },
        }
      }
    }
    return unchangedValue
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
        const debtorData = await parseDebtorInfoDocument({content, contentType})
        const divisor = debtorData.amountDivisor
        if (1e-99 <= divisor && divisor <= 1e99) {
          return debtorData
        }
      } catch (e: unknown) {
        if (!(e instanceof InvalidDocument)) throw e
      }
    }
    return undefined
  }

  async function fetchDebtorData(url: string): Promise<void> {
    loadingError = false
    url = url.split('#', 1)[0]
    if (url) {
      const data = await fetchDocument(url)
      const [debtorInfoUri, debtorUri = ''] = coinUrl.split('#', 2)
      if (
        data &&
        data.latestDebtorInfo.uri === debtorInfoUri &&
        data.debtorIdentity.uri === debtorUri
      ) {
        debtorData = data
        const unchangedParams = (
          unchangedValue &&
          unchangedValue.latestDebtorInfo.uri === debtorData.latestDebtorInfo.uri &&
          unchangedValue.debtorIdentity.uri === debtorData.debtorIdentity.uri &&
          unchangedValue.display.amountDivisor === debtorData.amountDivisor &&
          unchangedValue.display.decimalPlaces === debtorData.decimalPlaces &&
          unchangedValue.display.unit === debtorData.unit
        )
        unitRate = unchangedValue && unchangedParams
          ? (unchangedValue.exchangeRate * (amountDivisor || 1) / debtorData.amountDivisor)
          : (unchangedValue === undefined && unit === debtorData.unit ? 1 : NaN)
      } else {
        if (pegged) {
          app.addAlert(new Alert(LOADING_ERROR))
          if (unchangedValue === undefined) {
            unpeg()
          } else {
            loadingError = true
          }
        }
      }
    }
  }

  async function sendChanged(): Promise<void> {
    await tick()
    dispatch('changed');
  }

  function unpeg(): void {
    pegged = false
  }

  $: if (currentValue !== value) {
    currentValue = unchangedValue = value
    hasFlash = false
    flashlightOn = false
    showQrScanDialog = false
    pegged = value !== undefined
    coinUrl = value ? getCoinUrl(value) : ''
    debtorData = undefined
    unitRate = NaN
    invalidUnitRate = undefined
    loadingError = false
  } else {
    currentValue = value = calcPeg({
      amountDivisor,
      coinUrl,
      unitRate,
      debtorData,
      unchangedValue,
    })
    sendChanged()
  }

  $: if (pegged && coinUrl === '') {
    flashlightOn = false
    if (!showQrScanDialog) {
      showQrScanDialog = true
      app.startInteraction()
    }
  } else {
    showQrScanDialog = false
  }

  $: if (!pegged) {
    coinUrl = ''
    debtorData = undefined
    unchangedValue = undefined
    invalidUnitRate = undefined
    loadingError = false
  }

  $: invalid = value !== undefined && Boolean(invalidUnitRate)
  $: fetchDebtorData(coinUrl)
</script>

<style>
  .hidden {
    visibility: hidden;
  }
  .buttons-container {
    display: flex;
    width: 100%;
    justify-content: right;
    align-items: center;
  }
  .flashlight-button {
    flex-grow: 1;
    margin-left: 10px;
  }
</style>

{#if showQrScanDialog}
  <Dialog
    open
    scrimClickAction=""
    aria-labelledby="qrscan-title"
    aria-describedby="qrscan-content"
    on:MDCDialog:closed={unpeg}
    >
    <Title id="qrscan-title">Scan another currency's digital coin (a QR code)</Title>
    <Content id="qrscan-content">
      <QrScanner bind:hasFlash bind:result={coinUrl} {flashlightOn} />
    </Content>
    <Actions>
      <div class="buttons-container">
        <div class="flashlight-button">
          {#if hasFlash}
            <i
              on:click={toggleFlashlight}
              style="user-select: none"
              class="material-icons"
              aria-hidden="true"
              >
              {flashlightOn ? 'flashlight_off' : 'flashlight_on'}
            </i>
          {/if}
        </div>
        <div>
          {#if DEFAULT_PEG_ABBR && DEFAULT_PEG_COIN }
            <Button on:click={() => coinUrl = DEFAULT_PEG_COIN}>
              <Label>{DEFAULT_PEG_ABBR}</Label>
            </Button>
          {/if}
          <!-- The type="button" is necessary to prevent form submitting.-->
          <Button type="button" default use={[InitialFocus]}>
            <Label>Close</Label>
          </Button>
        </div>
      </div>
    </Actions>
  </Dialog>
{/if}

<FormField>
  <Switch color="primary" bind:checked={pegged} />
  <span slot="label">
    Set a fixed exchange rate between your currency and another currency.
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
      <HelperText slot="helper" persistent>
        The value of one unit of your digital currency{unit ? ` (1 ${unit})`: ''},
        represented in the units of the "{debtorData.debtorName}" currency ({debtorData.unit}).
      </HelperText>
    </Textfield>
  {:else if coinUrl !== ''}
    <div style="display: flex; align-items: center">
      {#if loadingError}
        <div style="margin: 0 10px; color: #888">{LOADING_ERROR}</div>
      {:else}
        <div style="margin-right: 1em; color: #c4c4c4">Loading...</div>
        <CircularProgress style="height: 32px; width: 32px;" indeterminate />
      {/if}
    </div>
  {/if}
</div>
