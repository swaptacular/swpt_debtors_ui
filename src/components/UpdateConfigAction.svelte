<script lang="ts">
  import type { AppState } from '../app-state'
  import type { UpdateConfigActionWithId } from '../operations'

  export let app: AppState
  export let action: UpdateConfigActionWithId
  let interestRate = action.interestRate ?? 0
  let summary = action.debtorInfo?.summary ?? ''
  let debtorName = action.debtorInfo?.debtorName ?? ''
  let debtorHomepageUri = action.debtorInfo?.debtorHomepage?.uri ?? ''
  let amountDivisor = action.debtorInfo?.amountDivisor ?? 100
  let decimalPlaces = action.debtorInfo?.decimalPlaces ?? 2
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

<button on:click={() => actionManager.remove()}>Dismiss</button>
<button on:click={() => actionManager.execute()}>Save</button>
