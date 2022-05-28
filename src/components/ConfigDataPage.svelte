<script lang="ts">
  import type { AppState, ConfigDataModel } from '../app-state'
  import { DOWNLOADED_QR_COIN_KEY } from '../app-state'
  import { onDestroy } from 'svelte'
  import Fab, { Icon } from '@smui/fab';
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

  onDestroy(() => {
    // Set the "downloaded coin" flag to true when exiting the page.
    if (localStorage.getItem(DOWNLOADED_QR_COIN_KEY) !== 'true') {
      localStorage.setItem(DOWNLOADED_QR_COIN_KEY, 'true')
    }
  })

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
    max-width: 66vh;
  }
  .text-container {
    display: flex;
    width: 100%;
    justify-content: center;
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
      <div class="qrcode-container">
        <QrGenerator value={link} bind:dataUrl />
      </div>
      <a class="download-link" href={dataUrl} download={`${info.debtorName}.png`} bind:this={downloadLinkElement}>download</a>

      <div class="text-container">
        <Paper elevation={8} style="margin: 0 16px 16px 16px; max-width: 600px">
          <Title>Your digital coin</Title>
          <Content>
            The image above (an ordinary QR code, indeed) uniquely
            identifies your digital currency. Whoever wants to use
            your currency, will have to scan this image with
            his/hers mobile device. Therefore, you should:
            <ol>
              <li>
                <a href="download" on:click|preventDefault={() => downloadLinkElement.click()}>
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
      </div>
    </svelte:fragment>

    <svelte:fragment slot="floating">
      <div class="fab-container">
        <Fab on:click={() => app.editConfig(debtorConfigData)}>
          <Icon class="material-icons">settings</Icon>
        </Fab>
      </div>
    </svelte:fragment>
  </Page>
{:else}
  <!-- Normally, this will never be shown. -->
  <Page title="Configure currency" />
{/if}
