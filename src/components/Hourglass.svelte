<script>
  import CircularProgress from '@smui/circular-progress'
</script>

<style>
  .centered {
    display: flex;
    position: absolute;
    left: 50%;
    top: 50%;
    margin-left: -16px;
    margin-top: -16px;
    justify-content: center;
  }
</style>

<div class="centered">
  <CircularProgress style="height: 32px; width: 32px;" indeterminate />
</div>
