import { OAuth2AuthCodePKCE } from './oauth2-auth-code-pkce.js'
import type { AuthTokenSource, GetTokenOptions } from '../server-api/index.js'


class Oauth2TokenSource implements AuthTokenSource {
  private helper = new OAuth2AuthCodePKCE({
    authorizationUrl: appConfig.oauth2.authorizationUrl,
    tokenUrl: appConfig.oauth2.tokenUrl,
    clientId: appConfig.oauth2.clientId,
    redirectUrl: appConfig.oauth2.redirectUrl,
    extraAuthorizationParams: {},
    scopes: ['access'],
    onAccessTokenExpiry(refreshAccessToken) {
      console.warn('Using refresh token is not tested and may not work.');
      return refreshAccessToken()
    },
    onInvalidGrant(_RedirectToAuthServer) {
      // return _RedirectToAuthServer()
    }
  })

  constructor() {
    let isReturningFromAuthServer
    try {
      isReturningFromAuthServer = this.helper.isReturningFromAuthServer()
    } catch (e: unknown) {
      alert(e)
    }
    if (isReturningFromAuthServer) {
      // Try to exchange the authentication code for access token as
      // soon as possible.
      this.getCurrentToken()
    }
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

  private invalidateCurrentToken() {
    this.helper.reset()
  }

  private async redirectToLoginPage(): Promise<never> {
    return await this.helper.fetchAuthorizationCode()
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

  async invalidateToken(token: string): Promise<void> {
    if (await this.getCurrentToken() === token) {
      this.invalidateCurrentToken()
    }
  }

}


export const oauth2TokenSource = new Oauth2TokenSource()
