<script lang="ts">
  import { DOWNLOADED_QR_COIN_KEY } from '../app-state'
  import type { AppState, ConfigDataModel } from '../app-state'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Paper, { Title, Content } from '@smui/paper'
  import Page from './Page.svelte'
  import QrGenerator from './QrGenerator.svelte'

  export let app: AppState
  export let model: ConfigDataModel
  export const snackbarBottom: string = "84px"
  assert(model)

  let downloadLinkElement: HTMLAnchorElement
  let dataUrl: string
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
  b {
    font-weight: bold;
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
                  Download the image.
                </li>
                <li>
                  Make sure that the image is publicly available, and
                  people are able to undoubtedly associate it with you
                  &ndash; the issuer of the currency.
                </li>
                <li>
                  Issue tokens of your digital currency (new money)
                  in circulation.
                </li>
              </ol>
              Currently, you have <b>{`${totalIssuedUnits} ${unit}`}</b>
              of your digital currency in circulation.
            </Content>
          </Paper>
        </Cell>
      </LayoutGrid>
    </svelte:fragment>

    <svelte:fragment slot="floating">
      <div class="fab-container">
        <Fab on:click={() => app.editConfig(debtorConfigData)}>
          <Icon class="material-icons">settings</Icon>
        </Fab>
      </div>
      <div class="fab-container">
        <Fab color="primary" on:click={save}>
          <Icon class="material-icons">save_alt</Icon>
        </Fab>
      </div>
    </svelte:fragment>
  </Page>
{:else}
  <!-- Normally, this will never be shown. -->
  <Page title="Configure currency" />
{/if}
