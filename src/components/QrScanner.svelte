<script lang="ts">
  import { onMount } from 'svelte'
  import QrScanner from 'qr-scanner'

  let videoElement: HTMLVideoElement

  // QrScanner.WORKER_PATH = 'path/to/qr-scanner-worker.min.js'

  onMount(() => {
    let destructor

    if (QrScanner.hasCamera()) {
      const qrScanner = new QrScanner(videoElement, result => console.log('decoded qr code:', typeof result))
      const startedScannerPromise = qrScanner.start()
      const tryToturnFlashOn = async (): Promise<boolean> => {
        let mustTurnFlashOff = false
        await startedScannerPromise
        if (await qrScanner.hasFlash()) {
          mustTurnFlashOff = qrScanner.isFlashOn()
          await qrScanner.turnFlashOn()
        }
        return mustTurnFlashOff
      }
      const flashEffortPromise = tryToturnFlashOn()

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
  }
</style>

<h1>QR Scanner</h1>
<video bind:this={videoElement}></video>
