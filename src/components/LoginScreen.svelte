<script lang="ts">
  import { login } from '../operations'
  import Paper, { Title, Content } from '@smui/paper'
  import Button, { Label } from "@smui/button"
  
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
  .logo-container :global(img) {
    height: 100%;
  }
  .floating {
    z-index: 3;
  }
  .paper-container {
    display: flex;
    justify-content: center;
    position: fixed;
    z-index: 2;
    top: 0;
    left: 0;
    width: 100%;
  }
  .floating :global(*) {
    pointer-events: auto;
  }
  .button-container {
    margin: 16px 16px;
  }
</style>

<div class="paper-container">
  <Paper style="margin: 36px 18px; max-width: 600px" elevation={8}>
    <Title>Welcome to Swaptacular!</Title>
    <Content>
      Swaptacular tries to make creating and issuing new digital
      currencies possible for everyone. Currency issuers are also
      called "debtors". This app connects you to a Swaptacular Debtors
      Agent, which will create and manage your digital currency for
      you.
    </Content>
  </Paper>
</div>

<div class="logo-container">
  <img src="favicon.svg" alt="Logo">
</div>
  
<div class="floating">
  <div class="button-container">
    <Button on:click={() => login()} variant="raised">
      <Label>Login</Label>
    </Button>
  </div>
</div>
