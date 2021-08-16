<script lang="ts">
  import { onMount } from 'svelte'
  import QrScanner from 'qr-scanner'

  export let result: string | undefined = undefined
  let videoElement: HTMLVideoElement

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
    }

    return destructor
  })
</script>

<style>
  video {
    width: 100%;
    max-width: 640px;
  }
</style>

<!-- svelte-ignore a11y-media-has-caption -->
<video bind:this={videoElement}></video>
