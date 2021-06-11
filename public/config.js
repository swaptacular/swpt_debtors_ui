window.appConfig = {
  serverApiEntrypoint: 'https://demo.swaptacular.org/debtors/.debtor',
  serverApiTimeout: 5000,
  oauth2: {
    authorizationUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/auth',
    tokenUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/token',
    clientId: 'localhost',
    redirectUrl: 'http://localhost:5000/',
  }
}
