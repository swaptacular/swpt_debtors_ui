<script lang="ts">
  import type {ActionModel} from '../stores'

  export let page: ActionModel
  let action = page.action
</script>

<h1>Action Page</h1>
<span>{$action}</span>
