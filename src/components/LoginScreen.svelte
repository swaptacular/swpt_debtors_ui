<script lang="ts">
  import { login } from '../operations'
  import Paper, { Title, Content } from '@smui/paper'
  import Fab, { Label } from '@smui/fab'
  
  export const snackbarBottom: string = '84px'
</script>

<style>
  .floating, .logo-container {
    display: flex;
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100%;
    justify-content: center;
    pointer-events: none;
  }
  .logo-container {
    height: 250px;
    z-index: 1;
  }
  .floating {
    z-index: 3;
  }
  .paper-container {
    position: fixed;
    z-index: 2;
    top: 0;
    left: 0;
    width: 100%;
  }
  .floating :global(*) {
    pointer-events: auto;
  }
  .fab-container {
    margin: 16px 16px;
  }
</style>

<div class="paper-container">
  <Paper style="margin: 36px 18px" elevation={8}>
    <Title>Welcome to Swaptacular!</Title>
    <Content>
      With Swaptacular you can create your own digital currency, which
      everybody can use. And it is easy!
    </Content>
  </Paper>
</div>

<div class="logo-container">
  <img src="favicon.svg" alt="Logo">
</div>
  
<div class="floating">
  <div class="fab-container">
    <Fab color="primary" on:click={() => login()} extended>
      <Label>Login</Label>
    </Fab>
  </div>
</div>
