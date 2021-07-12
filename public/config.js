window.appConfig = {
  serverApiEntrypoint: 'https://demo.swaptacular.org/debtors/.debtor',
  serverApiTimeout: 5000,
  oauth2: {
    authorizationUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/auth',
    tokenUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/token',
    clientId: 'localhost',
    redirectUrl: 'http://localhost:5000/',
  },
  TransferDeletionDelaySeconds: 15 * 86400,
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
