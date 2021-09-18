<script lang="ts">
  import { DOWNLOADED_QR_COIN_KEY, IS_A_NEWBIE_KEY } from '../app-state'
  import type { AppState, ConfigDataModel } from '../app-state'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Paper, { Title, Content } from '@smui/paper'
  import Page from './Page.svelte'
  import QrGenerator from './QrGenerator.svelte'

  export let app: AppState
  export let model: ConfigDataModel
  export let snackbarBottom: string = "84px"
  assert(model)

  let downloadLinkElement: HTMLAnchorElement
  let dataUrl: string
  const isANewbie = localStorage.getItem(IS_A_NEWBIE_KEY) === 'true'
  const downloadedQrCoin = localStorage.getItem(DOWNLOADED_QR_COIN_KEY) === 'true'
  const hideButtons = isANewbie && !downloadedQrCoin
  const debtorConfigData = app.getDebtorConfigData()
  const info = debtorConfigData.debtorInfo
  const link = `${app.publicInfoDocumentUri}#${app.debtorIdentityUri}`
  if (!info) {
    app.editConfig(debtorConfigData)
  }

  function save(): void {
    localStorage.setItem(DOWNLOADED_QR_COIN_KEY, 'true')
    downloadLinkElement.click()
  }

  $: balance = model.debtorRecord.balance
  $: totalIssuedUnits = app.amountToString(-balance)
  $: unit = app.unit
  $: snackbarBottom = hideButtons ? "0px" : "84px"
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
  .download-link {
    display: none;
  }
  .qrcode-container {
    width: 100%;
    text-align: center;
  }
  .qrcode-container :global(img) {
    width: 100%;
    max-width: 640px;
  }
  ol {
    list-style: decimal outside;
    margin: 0.75em 1.25em;
  }
  li {
    margin: 0.5em 0;
  }
  .amount {
    font-size: 1.1em;
    white-space: nowrap;
  }
  em {
    font-weight: bold;
    color: #444;
  }
</style>

{#if info}
  <Page title={info.debtorName}>
    <svelte:fragment slot="content">
      <LayoutGrid>
        <Cell span={12}>
          <div class="qrcode-container">
            <QrGenerator
              value="{link}"
              size={320}
              padding={28}
              errorCorrection="L"
              background="#FFFFFF"
              color="#000000"
              bind:dataUrl
              />
          </div>
          <a class="download-link" href={dataUrl} download={`${info.debtorName}.png`} bind:this={downloadLinkElement}>download</a>
        </Cell>

        <Cell span={12}>
          <Paper elevation={8}>
            <Title>Your digital coin</Title>
            <Content>
              The image above (an ordinary QR code, indeed) uniquely
              identifies your digital currency. Whoever wants to use
              your currency, will have to scan this image with
              his/hers mobile device. Therefore, you should:
              <ol>
                <li>
                  <a href="download" on:click|preventDefault={save}>
                    Download the image.
                  </a>
                </li>
                <li>
                  Make sure that the image is publicly available, and
                  people are able <em>to undoubtedly associate it with
                  you</em> &ndash; the issuer of the currency.
                </li>
                <li>
                  <a href="issue" on:click|preventDefault={model.goBack}>
                    Issue money in circulation.
                  </a>
                </li>
              </ol>
              Currently, you have a total of
              <em class="amount">{`${totalIssuedUnits} ${unit}`}</em>
              of your digital currency in circulation. (This figure
              may lag behind.)
            </Content>
          </Paper>
        </Cell>
      </LayoutGrid>
    </svelte:fragment>

    <svelte:fragment slot="floating">
      {#if !hideButtons}
        <div class="fab-container">
          <Fab on:click={() => app.editConfig(debtorConfigData)}>
            <Icon class="material-icons">settings</Icon>
          </Fab>
        </div>
        <div class="fab-container">
          <Fab color="primary" on:click={save}>
            <Icon class="material-icons">download</Icon>
          </Fab>
        </div>
      {/if}
    </svelte:fragment>
  </Page>
{:else}
  <!-- Normally, this will never be shown. -->
  <Page title="Configure currency" />
{/if}
