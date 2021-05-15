import { OAuth2AuthCodePKCE } from './oauth2-auth-code-pkce'

export const oauth = new OAuth2AuthCodePKCE({
  extraAuthorizationParams: {},
  authorizationUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/auth',
  tokenUrl: 'https://demo.swaptacular.org/debtors-hydra/oauth2/token',
  clientId: 'localhost',
  scopes: ['access'],
  redirectUrl: 'http://localhost:5000/',
  onAccessTokenExpiry(refreshAccessToken) {
    console.log("Expired! Access token needs to be renewed.");
    alert("We will try to get a new access token via grant code or refresh token.");
    return refreshAccessToken();
  },
  onInvalidGrant(refreshAuthCodeOrRefreshToken) {
    console.log("Expired! Auth code or refresh token needs to be renewed.");
    alert("Redirecting to auth server to obtain a new auth grant code.");
    return refreshAuthCodeOrRefreshToken();
  }
})


export async function handleOauth2Redirect() {
  if (await oauth.isReturningFromAuthServer()) {
    const token = await oauth.getAccessToken()
    console.log(token)
  }
}
