import { OAuth2AuthCodePKCE } from './oauth2-auth-code-pkce/index.js'
import type { AuthTokenSource, GetTokenOptions } from './server-api/index.js'


class Oauth2TokenSource implements AuthTokenSource {
  private helper = new OAuth2AuthCodePKCE({
    authorizationUrl: appConfig.oauth2.authorizationUrl,
    tokenUrl: appConfig.oauth2.tokenUrl,
    clientId: appConfig.oauth2.clientId,
    redirectUrl: appConfig.oauth2.redirectUrl,
    extraAuthorizationParams: {},
    scopes: ['access'],
    onAccessTokenExpiry(refreshAccessToken) {
      return refreshAccessToken();
    },
    onInvalidGrant(_RedirectToAuthServer) {
      console.log("Auth code or refresh token needs to be renewed.");
      // return RedirectToAuthServer();
    }
  })

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

  async init(): Promise<void> {
    await this.helper.isReturningFromAuthServer()
  }

}


export const oauth2TokenSource = new Oauth2TokenSource()
