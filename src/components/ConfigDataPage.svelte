<script lang="ts">
  import type { AppState, ConfigDataModel } from '../app-state'
  import QrCode from 'svelte-qrcode'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Paper, { Title, Content } from '@smui/paper'
  import Page from './Page.svelte'

  export let app: AppState
  export let model: ConfigDataModel
  export const snackbarBottom: string = "84px"
  assert(model)

  const debtorConfigData = app.getDebtorConfigData()
  const info = debtorConfigData.debtorInfo
  const link = `${app.publicInfoDocumentUri}#${app.debtorIdentityUri}`
  if (!info) {
    app.editConfig(debtorConfigData)
  }
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
  .qrcode-container {
    width: 100%;
    text-align: center;
  }
  .qrcode-container :global(img) {
    width: 100%;
    max-width: 600px;
  }
</style>

<Page title="Configuration">
  <svelte:fragment slot="content">
    {#if info}
      <LayoutGrid>
        <Cell span={12}>
          <div class="qrcode-container">
            <QrCode
              value="{link}"
              size="280"
              padding="20"
              errorCorrection="L"
              background="#FFFFFF"
              color="#000000"
              />
          </div>
        </Cell>

        <Cell span={12}>
          <Paper>
            <Title>Your "QR coin"</Title>
            <Content>
              The image above (an ordinary QR code, indeed) uniquely
              identifies your digital currency. Whoever wants to use
              your currency, will have to scan this image with his/her
              mobile device. Make sure this image is publicly
              available, and people are able to undoubtedly associate
              it with you &ndash; the issuer of the currency.
            </Content>
          </Paper>
        </Cell>
      </LayoutGrid>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={() => app.editConfig(debtorConfigData)}>
        <Icon class="material-icons">edit</Icon>
      </Fab>
    </div>
    <div class="fab-container">
      <!-- TODO: Implement file download on click. -->
      <Fab color="primary" on:click={() => undefined}>
        <Icon class="material-icons">save_alt</Icon>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
