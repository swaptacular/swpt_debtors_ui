<script lang="ts">
  import type {Alert} from '../stores'

  export let alerts: Alert[]
</script>

<h1>Alerts</h1>
<span>{alerts.length}</span>
