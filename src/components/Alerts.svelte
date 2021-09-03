<script lang="ts">
  import type { AppState, Alert } from '../app-state'
  import Dialog, { Title, Content, Actions } from '@smui/dialog'
  import Button, { Label } from '@smui/button'

  export let app: AppState
  export let alerts: Alert[]
</script>

{#if alerts.length > 0}
<Dialog
  open
  scrimClickAction=""
  escapeKeyAction=""
  aria-labelledby="alert-title"
  aria-describedby="alert-content"
  >
  <Title id="alert-title">Error</Title>
  <Content id="alert-content">{alerts[0].message}</Content>
  <Actions>
    <Button on:click={() => app.dismissAlert(alerts[0])}>
      <Label>OK</Label>
    </Button>
  </Actions>
</Dialog>
{/if}
