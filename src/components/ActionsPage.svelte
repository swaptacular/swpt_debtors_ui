<script lang="ts">
  import type {ActionsModel} from '../stores'

  export let page: ActionsModel
  let actions = page.actions
</script>

<h1>Actions Page</h1>
<span>{$actions.length}</span>
