<script lang="ts">
  import { onMount } from 'svelte'
  import QrScanner from 'qr-scanner'

  let videoElement: HTMLVideoElement

  // QrScanner.WORKER_PATH = 'path/to/qr-scanner-worker.min.js'

  onMount(async () => {
    var destructor

    if (QrScanner.hasCamera()) {
      const qrScanner = new QrScanner(videoElement, result => console.log('decoded qr code:', typeof result))
      await qrScanner.start()

      var mustTurnFlashOff = false
      if (await qrScanner.hasFlash()) {
        mustTurnFlashOff = !qrScanner.isFlashOn()
        await qrScanner.turnFlashOn()
      }

      destructor = () => {
        if (mustTurnFlashOff) {
          qrScanner.turnFlashOff()
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
