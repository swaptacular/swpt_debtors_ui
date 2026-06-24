// ../public/config.js makes this globally available.
declare var appConfig: {
  siteTitle: string,
  serverApiEntrypoint: string,
  serverApiTimeout: number,
  oauth2: {
    authorizationUrl: string,
    tokenUrl: string,
    clientId: string,
    redirectUrl: string,
    useLocalStorage: boolean,
  },
  transferDeletionDelaySeconds: number,
  defaultAmountDivisor: number,
  defaultDecimalPlaces: number,
  defaultPegAbbr: string,
  defaultPegCoin: string,
  registerIssuerUrl: string,
  installWalletUrl: string,
}

declare function assert(condition: any, msg?: string): asserts condition
