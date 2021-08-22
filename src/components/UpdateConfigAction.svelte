<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'
  import Fab, { Icon, Label } from '@smui/fab';
  import Page from './Page.svelte'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  let interestRate = action.interestRate ?? 0
  let summary = action.debtorInfo?.summary ?? ''
  let debtorName = action.debtorInfo?.debtorName ?? ''
  let debtorHomepageUri = action.debtorInfo?.debtorHomepage?.uri ?? ''
  let amountDivisor = action.debtorInfo?.amountDivisor ?? NaN
  let decimalPlaces = action.debtorInfo?.decimalPlaces ?? NaN
  let unit = action.debtorInfo?.unit ?? ''
  let peg = action.debtorInfo?.peg

  function createUpdatedAction(): UpdateConfigActionWithId {
    return {
      ...action,
      interestRate,
      debtorInfo: {
        summary: summary || undefined,
        debtorName,
        debtorHomepage: debtorHomepageUri ? { uri: debtorHomepageUri } : undefined,
        amountDivisor: amountDivisor | Number.EPSILON,
        decimalPlaces: Math.round(decimalPlaces),
        unit,
        peg,
      }
    }
  }

  $: actionManager = app.createActionManager(action, createUpdatedAction)
</script>

<style>
  .fab-container {
    margin: 16px 16px;
  }
</style>

<Page title="Update configuration" snackbarBottom="84px">
  <svelte:fragment slot="content">
    <h1>Update Config Action</h1>
    <form on:input={() => actionManager.markDirty()} on:change={() => actionManager.save()}>
      <p><label>interestRate:<input required type=number bind:value={interestRate}></label></p>
      <p><label>debtorName:<input required minlength="1" maxlength="40" bind:value={debtorName}></label></p>
      <p><label>summary:<textarea bind:value={summary} maxlength="1000"></textarea></label></p>
      <p><label>debtorHomepage:<input maxlength="10000" bind:value={debtorHomepageUri}></label></p>
      <p><label>amountDivisor:<input required type=number min="0" bind:value={amountDivisor}></label></p>
      <p><label>decimalPlaces:<input required type=number min="-20" max="20" step="1" bind:value={decimalPlaces}></label></p>
      <p><label>unit:<input required minlength="1" maxlength="40" bind:value={unit}></label></p>
    </form>
  </svelte:fragment>

  <svelte:fragment slot="floating">
    <div class="fab-container">
      <Fab on:click={() => actionManager.remove()} extended>
        <Label>Dismiss</Label>
      </Fab>
    </div>
    <div class="fab-container">
      <Fab color="primary" on:click={() => actionManager.execute()} extended>
        <Icon class="material-icons">save</Icon>
        <Label>Save</Label>
      </Fab>
    </div>
  </svelte:fragment>
</Page>
