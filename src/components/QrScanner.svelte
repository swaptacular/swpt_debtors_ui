<script lang="ts">
  import { onMount } from 'svelte'
  import QrScanner from 'qr-scanner'
  import { Icon } from '@smui/common'

  export let result: string | undefined = undefined
  let videoElement: HTMLVideoElement
  let noCamera = false

  // QrScanner.WORKER_PATH = 'path/to/qr-scanner-worker.min.js'

  onMount(() => {
    let destructor

    if (QrScanner.hasCamera()) {
      const qrScanner = new QrScanner(videoElement, r => { result = r })
      const startedScannerPromise = qrScanner.start()
      const tryTurningFlashOn = async (): Promise<boolean> => {
        let mustTurnFlashOff = false
        await startedScannerPromise
        if (await qrScanner.hasFlash()) {
          mustTurnFlashOff = qrScanner.isFlashOn()
          await qrScanner.turnFlashOn()
        }
        return mustTurnFlashOff
      }
      const flashEffortPromise = tryTurningFlashOn()

      destructor = async () => {
        if (await flashEffortPromise) {
          await qrScanner.turnFlashOff()
        }
        qrScanner.destroy()
      }
    } else {
      noCamera = true
    }

    return destructor
  })
</script>

<style>
  video {
    width: 100%;
    max-width: 640px;
  }
  .no-camera {
    width: 98%;
    text-align: center;
    color: #c4c4c4;
    padding: 20px 0 10px 0;
    border: 4px dotted;
  }
  .no-camera :global(i) {
    font-size: 150px;
  }
</style>

{#if noCamera}
  <div class="no-camera">
    <Icon class="material-icons">videocam_off</Icon>
    <!-- No camera -->
  </div>
{:else}
  <!-- svelte-ignore a11y-media-has-caption -->
  <video bind:this={videoElement}></video>
{/if}
