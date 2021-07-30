<script lang="ts">
  export let waitingAttempts: number
</script>

{#if waitingAttempts > 0 }
  <h1>Hourglass</h1>
{/if}
