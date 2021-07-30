<script lang="ts">
  import { getContext } from 'svelte';
  import type {AppState, Alert} from '../stores'

  export let alerts: Alert[]
  const appState: AppState = getContext('appState')
</script>

<ol>
  {#each alerts as alert }
    <li>{alert.message} <button on:click={() => appState.dismissAlert(alert)}>Dismiss</button></li>
  {/each}
</ol>
