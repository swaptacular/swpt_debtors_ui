<script lang="ts">
  import type { AppState, Alert } from '../app-state'

  export let app: AppState
  export let alerts: Alert[]
</script>

<ol>
  {#each alerts as alert }
    <li>{alert.message} <button on:click={() => app.dismissAlert(alert)}>Dismiss</button></li>
  {/each}
</ol>
