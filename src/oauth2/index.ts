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
    async onAccessTokenExpiry(_refreshAccessToken) {
      const message = 'Using refresh tokens is disabled.'
      console.warn(message);
      throw new Error(message)
      // return _refreshAccessToken()
    },
    onInvalidGrant(_redirectToAuthServer) {
      // return _redirectToAuthServer()
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
      // soon as possible.
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
