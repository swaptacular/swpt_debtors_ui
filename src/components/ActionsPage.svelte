<script lang="ts">
  import {
    DOWNLOADED_QR_COIN_KEY,
    IS_A_NEWBIE_KEY,
    HAS_LOADED_PAYMENT_REQUEST_KEY,
    INSTALL_WALLET_URL,
  } from '../app-state'
  import type { AppState, ActionsModel } from '../app-state'
  import type { ActionRecordWithId } from '../operations'
  import Fab, { Icon } from '@smui/fab';
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import ActionCard from './ActionCard.svelte'
  import Checkbox from '@smui/checkbox'
  import FormField from '@smui/form-field'
  import Paper, { Title, Content } from '@smui/paper'
  import Page from './Page.svelte'
  import Card, { Actions, Content as CardContent } from '@smui/card'
  import Button, { Label } from '@smui/button'
  import MakePaymentDialog from './MakePaymentDialog.svelte'

  export let app: AppState
  export let model: ActionsModel
  export const snackbarBottom: string = '84px'

  const SHOW_FOREIGN_ACTIONS_KEY = 'debtors.showForeignActions'
  const debtorConfigData = app.getDebtorConfigData()
  const scrollElement = document.documentElement
  const downloadedQrCoin = localStorage.getItem(DOWNLOADED_QR_COIN_KEY) === 'true'
  let isANewbie = localStorage.getItem(IS_A_NEWBIE_KEY) === 'true'
  let showForeignActions = localStorage.getItem(SHOW_FOREIGN_ACTIONS_KEY) === 'true'
  let hasLoadedPaymentRequest = localStorage.getItem(HAS_LOADED_PAYMENT_REQUEST_KEY) === 'true'
  let showMakePaymentDialog = false

  function separateForeignActions(allActions: ActionRecordWithId[]): [ActionRecordWithId[], ActionRecordWithId[]] {
    let regularActions = []
    let foreignActions = []
    for (const action of allActions) {
      if (action.actionType === 'AbortTransfer' && !action.transfer.originatesHere) {
        foreignActions.push(action)
      } else {
        regularActions.push(action)
      }
    }
    return [regularActions, foreignActions]
  }

  function showAction(actionId: number): void {
    const scrollTop = scrollElement.scrollTop
    const scrollLeft = scrollElement.scrollLeft
    app.showAction(actionId, () => {
      app.pageModel.set({ ...model, scrollTop, scrollLeft })
    })
  }

  function showTransfers(): void {
    app.startInteraction()
    app.showTransfers()
  }

  function showConfig(): void {
    app.startInteraction()
    app.showConfig()
  }

  function editConfig(): void {
    app.startInteraction()
    app.editConfig(debtorConfigData)
  }

  function scanPaymentRequest(): void {
    app.startInteraction()
    showMakePaymentDialog = true
  }

  $: actions = model.actions
  $: [regularActions, foreignActions] = separateForeignActions($actions)
  $: hasRegularActions = regularActions.length > 0
  $: hasForeignActions = foreignActions.length > 0
  $: hasConfiguredCurrency = debtorConfigData.debtorInfo !== undefined
  $: localStorage.setItem(SHOW_FOREIGN_ACTIONS_KEY, String(showForeignActions))
  $: suggestQrCoinDownload = isANewbie && hasConfiguredCurrency && !hasRegularActions && !downloadedQrCoin
  $: if (!hasConfiguredCurrency) {
    localStorage.setItem(IS_A_NEWBIE_KEY, 'true')
    isANewbie = true
  }
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
  .no-actions {
    --no-actions-color: #888;
    font-size: 1.25em;
    margin: 36px 18px 26px 18px;
    text-align: center;
    color: var(--no-actions-color);
  }
  .to-make-payment {
    margin-top: 0.75em;
    font-weight: bold;
    font-size: 1.1em;
  }
  ol {
    list-style: decimal outside;
    margin: 0.5em 1.25em 1.25em 1.25em;
  }
  li {
    margin: 0.25em 0;
  }
  .to-install-wallet {
    margin-top: 0.75em;
    font-weight: bold;
  }
</style>

<Page title="Actions" scrollTop={model.scrollTop} scrollLeft={model.scrollLeft}>
  <svelte:fragment slot="content">
    {#if hasRegularActions }
      <LayoutGrid>
        {#each regularActions as action (action.actionId)}
          <Cell>
            <ActionCard {action} show={() => showAction(action.actionId)} />
          </Cell>
        {/each}
      </LayoutGrid>
    {:else}
      {#if hasConfiguredCurrency}
        {#if suggestQrCoinDownload}
          <LayoutGrid>
            <Cell>
              <Paper elevation={8} style="margin-bottom: 16px">
                <Title>Congratulations!</Title>
                <Content>
                  You have successfully configured your digital currency. Press the
                  <Icon style="vertical-align: middle" class="material-icons">settings_applications</Icon>
                  button below to download your digital coin.
                </Content>
              </Paper>
            </Cell>
          </LayoutGrid>
        {:else}
          {#if !isANewbie || hasLoadedPaymentRequest}
            <p class="no-actions">
              Press the
              <Icon class="material-icons" style="vertical-align: middle">local_atm</Icon>
              button below to load a payment request and issue new money in circulation.
            </p>
          {:else}
            <LayoutGrid>
              <Cell span={12}>
                <Paper elevation={8} style="margin-bottom: 16px">
                  <Title>How do I put my currency into circulation?</Title>
                  <Content>
                    <p>
                      To create and hold any amount in your own
                      currency, you first need to
                      {#if INSTALL_WALLET_URL}
                        <a href="{INSTALL_WALLET_URL}" target="_blank" rel="noreferrer">
                          install a digital wallet app!
                        </a>
                      {:else}
                        install a digital wallet app!
                      {/if}
                    </p>
                    <p class="to-make-payment">To fund your wallet:</p>
                    <ol>
                      <li>In the wallet app, create an account for your own currency.</li>
                      <li>In the wallet app, create a payment request to yourself.</li>
                      <li>
                        Click the
                        <Icon class="material-icons" style="margin: 0 0.15em; vertical-align: middle">local_atm</Icon>
                        button below and load your payment request.
                      </li>
                      <li>Confirm the payment.</li>
                    </ol>
                    <p>
                      <strong>Important:</strong>
                      To view the QR code for your currency, use the
                      <Icon class="material-icons" style="margin: 0 0.15em; vertical-align: middle">settings_applications</Icon>
                      button below. To scan the QR code, you'll need
                      to either print it or open it on another device.
                    </p>
                  </Content>
                </Paper>
              </Cell>
            </LayoutGrid>
          {/if}
        {/if}
      {:else}
        <LayoutGrid>
          <Cell>
            <Paper elevation={8} style="margin-bottom: 16px">
              <Title>Are you new to {appConfig.siteTitle}?</Title>
              <Content>
                Each time you open this app, you will see the
                "Actions" screen first. This screen shows things that
                require your attention, such as actions that have been
                started but not yet completed.
              </Content>
            </Paper>
          </Cell>
          <Cell>
            <Card>
              <CardContent>
                A new digital currency has been created for you.
                Before anyone can use it, you will need to provide
                some basic information, such as the currency name,
                interest rate, and a few other settings.
              </CardContent>
              <Actions fullBleed>
                <Button on:click={editConfig}>
                  <Label>Configure currency</Label>
                  <i class="material-icons" aria-hidden="true">arrow_forward</i>
                </Button>
              </Actions>
            </Card>
          </Cell>
        </LayoutGrid>
      {/if}
    {/if}
    {#if hasForeignActions}
      <LayoutGrid>
        <Cell span={12}>
          <FormField>
            <Checkbox bind:checked={showForeignActions} />
            <span slot="label">Show troubled payments initiated from other devices.</span>
          </FormField>
        </Cell>
        {#if showForeignActions }
          {#each foreignActions as action (action.actionId)}
            <Cell>
              <ActionCard color="secondary" {action} show={() => showAction(action.actionId)} />
            </Cell>
          {/each}
        {/if}
      </LayoutGrid>
    {/if}

    <MakePaymentDialog bind:open={showMakePaymentDialog}/>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={showTransfers}>
        <Icon class="material-icons">history</Icon>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab
        color={!suggestQrCoinDownload && hasConfiguredCurrency ? "primary" : "secondary"}
        on:click={scanPaymentRequest}
        >
        <Icon class="material-icons">local_atm</Icon>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab color="primary" on:click={showConfig}>
        <Icon class="material-icons">settings_applications</Icon>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
