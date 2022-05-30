window.appConfig = {
  serverApiEntrypoint: 'https://demo.swaptacular.org/debtors/.debtor',
  serverApiTimeout: 8000,
  oauth2: {
    authorizationUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/auth',
    tokenUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/token',
    clientId: 'localhost',
    redirectUrl: 'http://localhost:5000/',
    useLocalStorage: false,
  },
  transferDeletionDelaySeconds: 15 * 86400,
  defaultPegAbbr: '',
  defaultPegCoin: '',
}

window.assert = function assert(condition, msg) {
  if (!condition) {
    let e = new Error(msg)
    e.name = 'AssertionError'
    throw e
  }
}

// if('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('./sw.js')
// }
