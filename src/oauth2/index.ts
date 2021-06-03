import { OAuth2AuthCodePKCE } from './oauth2-auth-code-pkce.js'
import type { AuthTokenSource, GetTokenOptions } from '../server-api/index.js'


class Oauth2TokenSource implements AuthTokenSource {
  private helper = new OAuth2AuthCodePKCE({
    fetchTimeout: appConfig.serverApiTimeout,
    authorizationUrl: appConfig.oauth2.authorizationUrl,
    tokenUrl: appConfig.oauth2.tokenUrl,
    clientId: appConfig.oauth2.clientId,
    redirectUrl: appConfig.oauth2.redirectUrl,
    extraAuthorizationParams: {},
    scopes: ['access'],
    async onAccessTokenExpiry(_refreshAccessToken) {
      // This function is called when the access token has expired,
      // and there is a refresh token. If the result of
      // `_refreshAccessToken()` is returned, an attempt will be made
      // to obtain a new access token. This functionality in not
      // tested, and not needed, so we throw an error here.
      const message = 'Using refresh tokens is disabled.'
      console.warn(message);
      throw new Error(message)
    },
    onInvalidGrant(_redirectToAuthServer) {
      // This function is called when the authorization code can not
      // be exchanged for a token. If `_redirectToAuthServer` is
      // called it will redirect to the authentication server. In our
      // case, we do not want this, so we do nothing here.
    }
  })

  constructor() {
    let isReturningFromAuthServer
    try {
      isReturningFromAuthServer = this.helper.isReturningFromAuthServer()
    } catch (e: unknown) {
      console.log(e)
    }
    if (isReturningFromAuthServer) {
      // Try to exchange the authentication code for access token as
      // soon as possible, not awaiting the result.
      this.getCurrentToken()
    }
  }

  async getToken(options?: GetTokenOptions): Promise<string> {
    const { attemptLogin = true } = options ?? {}
    const token = await this.getCurrentToken()
    if (!token) {
      if (attemptLogin) {
        await this.redirectToLoginPage()  // waits forever
      }
      throw new Error('can not obtain token')
    }
    return token
  }

  invalidateToken(token: string): void {
    this.helper.invalidateAccessToken(token)
  }

  logout(): void {
    this.helper.reset()
  }

  private async getCurrentToken(): Promise<string | undefined> {
    let accessContext
    try {
      accessContext = await this.helper.getAccessToken()
    } catch {
      return
    }
    return accessContext.token?.value
  }

  private async redirectToLoginPage(): Promise<never> {
    return await this.helper.fetchAuthorizationCode()
  }

}


export const oauth2TokenSource = new Oauth2TokenSource()
