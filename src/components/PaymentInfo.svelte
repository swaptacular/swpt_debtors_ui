<script lang="ts">
  import type { AppState } from '../app-state'
  import type { PaymentDescription } from '../payment-requests'
  import { MAX_INT64 } from '../app-state'
  import { getContext } from 'svelte'
  import Paper, { Title, Content } from '@smui/paper'
  import LayoutGrid, { Cell } from '@smui/layout-grid'
  import Textfield from '@smui/textfield'
  import TextfieldIcon from '@smui/textfield/icon'
  import HelperText from '@smui/textfield/helper-text/index'
  import Chip, { Text } from '@smui/chips'
  import Tooltip, { Wrapper } from '@smui/tooltip'

  export let payeeName: string
  export let unitAmount: string | number
  export let description: PaymentDescription
  export let title: string
  export let tooltip: string
  export let unit: string
  export let forbidAmountChange: boolean = true
  export let invalidPayeeName: boolean | undefined = undefined
  export let invalidUnitAmount: boolean | undefined = undefined

  const app: AppState = getContext('app')
  const maxUnitAmount = app.amountToString(MAX_INT64 - 1000000n)
  const unitAmountStep = app.amountToString(app.smallestDisplayableNumber)
</script>

<style>
  pre {
    color: #888;
    font-size: 0.9em;
    font-family: "Roboto Mono", monospace;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    width: 100%;
  }
  a {
    overflow-wrap: break-word;
    width: 100%;
  }
</style>

<LayoutGrid>
  <Cell spanDevices={{ desktop: 12, tablet: 8, phone: 4 }}>
    <Paper style="margin-top: 16px; margin-bottom: 28px" elevation={4}>
      <Title style="display: flex; justify-content: space-between; align-items: center">
        {title}
        <Wrapper>
          <Chip chip="help" on:click={() => undefined}>
            <Text tabindex="0">status</Text>
          </Chip>
          <Tooltip>{tooltip}</Tooltip>
        </Wrapper>
      </Title>
      <Content>
        {#if description.contentFormat === '.'}
          <a href="{description.content}" target="_blank">{description.content}</a>
        {:else if description.content}
          <pre>{description.content}</pre>
        {:else}
          <span style="color: #c4c4c4">The payment request does not contain a description.</span>
        {/if}
      </Content>
    </Paper>
  </Cell>

  <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
    <Textfield
      variant="outlined"
      style="width: 100%"
      label="Payee name"
      input$readonly
      input$spellcheck="false"
      bind:invalid={invalidPayeeName}
      value={payeeName}
      >
      <HelperText slot="helper" persistent>
        The name of the recipient of the payment.
      </HelperText>
    </Textfield>
  </Cell>

  {#if forbidAmountChange}
    <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
      <Textfield
        required
        variant="outlined"
        style="width: 100%"
        type="number"
        label="Amount"
        input$readonly
        input$step="any"
        bind:invalid={invalidUnitAmount}
        value={unitAmount}
        suffix={unit}
        >
        <HelperText slot="helper" persistent>
          The amount that will be transferred to the payee.
        </HelperText>
      </Textfield>
    </Cell>
  {:else}
    <Cell spanDevices={{ desktop: 6, tablet: 4, phone: 4 }}>
      <Textfield
        required
        variant="outlined"
        type="number"
        input$min={unitAmountStep}
        input$max={maxUnitAmount}
        input$step={unitAmountStep}
        style="width: 100%"
        withTrailingIcon={invalidUnitAmount}
        bind:value={unitAmount}
        bind:invalid={invalidUnitAmount}
        label="Amount"
        suffix={unit}
        >
        <svelte:fragment slot="trailingIcon">
          {#if invalidUnitAmount}
            <TextfieldIcon class="material-icons">error</TextfieldIcon>
          {/if}
        </svelte:fragment>
        <HelperText slot="helper" persistent>
          The amount that will be transferred to the payee.
        </HelperText>
      </Textfield>
    </Cell>
  {/if}
</LayoutGrid>
