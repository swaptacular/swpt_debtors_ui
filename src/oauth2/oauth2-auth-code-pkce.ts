/**
 * An implementation of rfc6749#section-4.1 and rfc7636.
 *
 * Derived from https://github.com/BitySA/oauth2-auth-code-pkce
 */

export type Configuration = {
  authorizationUrl: string;
  clientId: string;
  fetchTimeout: number,
  explicitlyExposedTokens?: string[];
  onAccessTokenExpiry: (refreshAccessToken: () => Promise<AccessContext>) => Promise<AccessContext>;
  onInvalidGrant: (refreshAuthCodeOrRefreshToken: () => Promise<never>) => void;
  redirectUrl: string;
  scopes: string[];
  tokenUrl: string;
  extraAuthorizationParams?: ObjStringDict;
  extraRefreshParams?: ObjStringDict;
}

export type State = {
  accessToken?: AccessToken;
  authorizationCode?: string;
  codeChallenge?: string;
  codeVerifier?: string;
  explicitlyExposedTokens?: ObjStringDict;
  refreshToken?: RefreshToken;
  stateQueryParam?: string;
  scopes?: string[];
}

export type RefreshToken = {
  value: string;
};

export type AccessToken = {
  value: string;
  expiry: string;
};

export type AccessContext = {
  token?: AccessToken;
  explicitlyExposedTokens?: ObjStringDict;
  scopes?: string[];
  refreshToken?: RefreshToken;
};

type ObjStringDict = { [_: string]: string };

/**
 * A list of OAuth2AuthCodePKCE errors.
 */
// To "namespace" all errors.
export class ErrorOAuth2 extends Error { name = 'ErrorOAuth2' }

// For really unknown errors.
export class UnknownError extends ErrorOAuth2 { name = 'UnknownError' }

// Some generic, internal errors that can happen.
export class NoAuthCode extends ErrorOAuth2 { name = 'NoAuthCode' }
export class InvalidReturnedStateParam extends ErrorOAuth2 { name = 'InvalidReturnedStateParam' }
export class InvalidJson extends ErrorOAuth2 { name = 'InvalidJson' }

// Errors that occur across many endpoints
export class InvalidScope extends ErrorOAuth2 { name = 'InvalidScope' }
export class InvalidRequest extends ErrorOAuth2 { name = 'InvalidRequest' }
export class InvalidToken extends ErrorOAuth2 { name = 'InvalidToken' }

/**
 * Possible authorization grant errors given by the redirection from the
 * authorization server.
 */
export class AuthenticationGrantError extends ErrorOAuth2 { name = 'AuthenticationGrantError' }
export class UnauthorizedClient extends AuthenticationGrantError { name = 'UnauthorizedClient' }
export class AccessDenied extends AuthenticationGrantError { name = 'AccessDenied' }
export class UnsupportedResponseType extends AuthenticationGrantError { name = 'UnsupportedResponseType' }
export class ServerError extends AuthenticationGrantError { name = 'ServerError' }
export class TemporarilyUnavailable extends AuthenticationGrantError { name = 'TemporarilyUnavailable' }

/**
 * A list of possible access token response errors.
 */
export class AccessTokenResponseError extends ErrorOAuth2 { toString(): string { return 'AccessTokenResponseError'; } }
export class InvalidClient extends AccessTokenResponseError { toString(): string { return 'InvalidClient'; } }
export class InvalidGrant extends AccessTokenResponseError { toString(): string { return 'InvalidGrant'; } }
export class UnsupportedGrantType extends AccessTokenResponseError { toString(): string { return 'UnsupportedGrantType'; } }

/**
 * WWW-Authenticate error object structure for less error prone handling.
 */
export class ErrorWWWAuthenticate {
  public realm: string = "";
  public error: string = "";
}

export const RawErrorToErrorClassMap: { [_: string]: any } = {
  invalid_request: InvalidRequest,
  invalid_grant: InvalidGrant,
  unauthorized_client: UnauthorizedClient,
  access_denied: AccessDenied,
  unsupported_response_type: UnsupportedResponseType,
  invalid_scope: InvalidScope,
  server_error: ServerError,
  temporarily_unavailable: TemporarilyUnavailable,
  invalid_client: InvalidClient,
  unsupported_grant_type: UnsupportedGrantType,
  invalid_json: InvalidJson,
  invalid_token: InvalidToken,
};

/**
 * Translate the raw error strings returned from the server into error classes.
 */
export function toErrorClass(rawError: string): ErrorOAuth2 {
  return new (RawErrorToErrorClassMap[rawError] || UnknownError)();
}

/**
 * A convience function to turn, for example, `Bearer realm="bity.com", 
 * error="invalid_client"` into `{ realm: "bity.com", error: "invalid_client"
 * }`.
 */
export function fromWWWAuthenticateHeaderStringToObject(a: string): ErrorWWWAuthenticate {
  const obj = a
    .slice("Bearer ".length)
    .replace(/"/g, '')
    .split(', ')
    .map(tokens => { const [k, v] = tokens.split('='); return { [k]: v }; })
    .reduce((a, c) => ({ ...a, ...c }), {});

  return { realm: obj.realm, error: obj.error };
}

/**
 * To store the OAuth client's data between websites due to redirection.
 */
export const LOCALSTORAGE_ID = `oauth2authcodepkce`;
export const LOCALSTORAGE_STATE = `${LOCALSTORAGE_ID}-state`;

/**
 * The maximum length for a code verifier for the best security we can offer.
 * Please note the NOTE section of RFC 7636 § 4.1 - the length must be >= 43,
 * but <= 128, **after** base64 url encoding. This means 32 code verifier bytes
 * encoded will be 43 bytes, or 96 bytes encoded will be 128 bytes. So 96 bytes
 * is the highest valid value that can be used.
 */
export const RECOMMENDED_CODE_VERIFIER_LENGTH = 96;

/**
 * A sensible length for the state's length, for anti-csrf.
 */
export const RECOMMENDED_STATE_LENGTH = 32;

/**
 * Character set to generate code verifier defined in rfc7636.
 */
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';


/**
 * Add `timeout` to fetch's options.
 */
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit & { timeout?: number }) {
  const { timeout } = options;

  if (timeout === undefined) {
    return await fetch(resource, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  return response;
}

/**
 * OAuth 2.0 client that ONLY supports authorization code flow, with PKCE.
 *
 * Many applications structure their OAuth usage in different ways. This class
 * aims to provide both flexible and easy ways to use this configuration of
 * OAuth.
 *
 * See `example.ts` for how you'd typically use this.
 *
 * For others, review this class's methods.
 */
export class OAuth2AuthCodePKCE {
  private config: Configuration;
  private authorizationCodeForAccessTokenRequest?: Promise<AccessContext>;

  constructor(config: Configuration) {
    this.config = config;
    this.recoverState();
  }

  /**
   * If there is an error, it will be passed back as a rejected Promise.
   * If there is no code, the user should be redirected via
   * [fetchAuthorizationCode].
   */
  public isReturningFromAuthServer(): boolean {
    const error = OAuth2AuthCodePKCE.extractParamFromUrl(location.href, 'error');
    if (error) {
      throw toErrorClass(error);
    }

    const authorizationCode = OAuth2AuthCodePKCE.extractParamFromUrl(location.href, 'code');
    if (!authorizationCode) {
      return false;
    }

    const state = this.recoverState()
    const stateQueryParam = OAuth2AuthCodePKCE.extractParamFromUrl(location.href, 'state');
    if (stateQueryParam !== state.stateQueryParam) {
      console.warn("State query string parameter doesn't match the one sent. Possible malicious activity somewhere.");
      throw new InvalidReturnedStateParam();
    }

    this.setState({ ...state, authorizationCode });
    return true;
  }

  /**
   * Fetch an authorization grant via redirection. In a sense this function
   * doesn't return because of the redirect behavior (uses `location.replace`).
   *
   * @param oneTimeParams A way to specify "one time" used query string
   * parameters during the authorization code fetching process, usually for
   * values which need to change at run-time.
   */
  public async fetchAuthorizationCode(): Promise<never> {
    const { clientId, extraAuthorizationParams, redirectUrl, scopes } = this.config;
    const { codeChallenge, codeVerifier } = await OAuth2AuthCodePKCE.generatePKCECodes();
    const stateQueryParam = OAuth2AuthCodePKCE.generateRandomState(RECOMMENDED_STATE_LENGTH);

    this.setState({
      ...this.recoverState(),
      codeChallenge,
      codeVerifier,
      stateQueryParam,
    });

    let url = this.config.authorizationUrl
      + `?response_type=code&`
      + `client_id=${encodeURIComponent(clientId)}&`
      + `redirect_uri=${encodeURIComponent(redirectUrl)}&`
      + `scope=${encodeURIComponent(scopes.join(' '))}&`
      + `state=${stateQueryParam}&`
      + `code_challenge=${encodeURIComponent(codeChallenge)}&`
      + `code_challenge_method=S256`;

    if (extraAuthorizationParams) {
      url += `&${OAuth2AuthCodePKCE.objectToQueryString(extraAuthorizationParams)}`
    }

    location.replace(url);
    return new Promise(() => { })
  }

  /**
   * Tries to get the current access token. If there is none
   * it will fetch another one. If it is expired, it will fire
   * [onAccessTokenExpiry] but it's up to the user to call the refresh token
   * function. This is because sometimes not using the refresh token facilities
   * is easier.
   */
  public getAccessToken(): Promise<AccessContext> {
    const { onAccessTokenExpiry } = this.config;

    // This reads the current state from the local storage, which
    // fixes the most annoying problems when two instances of the app
    // run together and update the current state. A real fix would be
    // to use indexedDB to store the state, and perform every state
    // change in a transaction.
    const {
      accessToken,
      authorizationCode,
      explicitlyExposedTokens,
      refreshToken,
      scopes
    } = this.recoverState();

    // We use `this.authorizationCodeForAccessTokenRequest` to allow
    // several parallel `getAccessToken()` calls to reuse the same
    // promise, instead of making multiple requests to the auth server
    // (of which only the first would successfully obtain a token).
    if (this.authorizationCodeForAccessTokenRequest) {
      return this.authorizationCodeForAccessTokenRequest;
    }

    if (authorizationCode) {
      this.authorizationCodeForAccessTokenRequest = this.exchangeAuthorizationCodeForAccessToken();
      return this.authorizationCodeForAccessTokenRequest;
    }

    // Depending on the server (and config), refreshToken may not be available.
    if (refreshToken && OAuth2AuthCodePKCE.isAccessTokenExpired(accessToken)) {
      return onAccessTokenExpiry(() => this.exchangeRefreshTokenForAccessToken());
    }

    return Promise.resolve({
      token: accessToken,
      explicitlyExposedTokens,
      scopes,
      refreshToken
    });
  }

  public invalidateAccessToken(tokenValue: string) {
    const state = this.recoverState()
    if (state.accessToken?.value === tokenValue) {
      state.accessToken = undefined;
      this.setState(state)
    }
  }

  /**
   * Resets the state of the client. Equivalent to "logging out" the user.
   */
  public reset(): State {
    const state = {}
    this.authorizationCodeForAccessTokenRequest = undefined;
    this.setState(state);
    return state
  }

  /**
   * Fetch an access token from the remote service. You may pass a custom
   * authorization grant code for any reason, but this is non-standard usage.
   */
  private async exchangeAuthorizationCodeForAccessToken(): Promise<AccessContext> {
    let state = this.recoverState();
    const { authorizationCode, codeVerifier } = state;
    const { clientId, onInvalidGrant, redirectUrl, explicitlyExposedTokens, fetchTimeout } = this.config;

    const body = `grant_type=authorization_code&`
      + `code=${encodeURIComponent(authorizationCode || '')}&`
      + `redirect_uri=${encodeURIComponent(redirectUrl)}&`
      + `client_id=${encodeURIComponent(clientId)}&`
      + `code_verifier=${codeVerifier || ''}`;

    let response;
    try {
      response = await fetchWithTimeout(this.config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: fetchTimeout,
        body,
      });

    } finally {
      this.authorizationCodeForAccessTokenRequest = undefined;
    }

    state.authorizationCode = undefined;
    state.codeChallenge = undefined;
    state.codeVerifier = undefined;
    state.stateQueryParam = undefined;

    if (!response.ok) {
      this.setState(state);

      let error;
      try {
        error = (await response.json())?.error;
      } catch {
        error = 'invalid_json';
      }
      if (error === 'invalid_grant') {
        onInvalidGrant(() => this.fetchAuthorizationCode());
      }
      throw toErrorClass(error);
    }

    try {
      const json = await response.json();
      const extractTokens = (tokenNames: string[]): ObjStringDict => Object.fromEntries(tokenNames
        .map((name) => [name, json[name]])
        .filter(([_name, value]) => value !== undefined)
      );
      const { access_token, expires_in, refresh_token, scope } = json;

      state = {
        ...state,
        accessToken: {
          value: String(access_token),
          expiry: (new Date(Date.now() + (Number(expires_in) * 1000))).toString(),
        },
        refreshToken: refresh_token ? { value: String(refresh_token) } : undefined,
        scopes: scope ? String(scope).split(' ') : undefined,
        explicitlyExposedTokens: explicitlyExposedTokens ? extractTokens(explicitlyExposedTokens) : undefined,
      }

    } finally {
      this.setState(state);
    }

    return {
      token: state.accessToken,
      scopes: state.scopes,
      explicitlyExposedTokens: state.explicitlyExposedTokens,
    };
  }

  /**
   * Refresh an access token from the remote service.
   */
  private exchangeRefreshTokenForAccessToken(): Promise<AccessContext> {
    // TODO: This method currently does not work and can not be used.

    const state = this.recoverState()
    const { refreshToken } = state;
    const { extraRefreshParams, clientId, tokenUrl } = this.config;

    if (!refreshToken) {
      console.warn('No refresh token is present.');
    }

    const url = tokenUrl;
    let body = `grant_type=refresh_token&`
      + `refresh_token=${refreshToken?.value}&`
      + `client_id=${clientId}`;

    if (extraRefreshParams) {
      body = `${url}&${OAuth2AuthCodePKCE.objectToQueryString(extraRefreshParams)}`
    }

    return fetchWithTimeout(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: this.config.fetchTimeout,
    })
      .then(res => res.status >= 400 ? res.json().then(data => Promise.reject(data)) : res.json())
      .then((json) => {
        const { access_token, expires_in, refresh_token, scope } = json;
        const { explicitlyExposedTokens } = this.config;
        let scopes = [];
        let tokensToExpose = {};

        const accessToken: AccessToken = {
          value: access_token,
          expiry: (new Date(Date.now() + (parseInt(expires_in) * 1000))).toString()
        };
        state.accessToken = accessToken;

        if (refresh_token) {
          const refreshToken: RefreshToken = {
            value: refresh_token
          };
          state.refreshToken = refreshToken;
        }

        if (explicitlyExposedTokens) {
          tokensToExpose = Object.fromEntries(
            explicitlyExposedTokens
              .map((tokenName: string): [string, string | undefined] => [tokenName, json[tokenName]])
              .filter(([_, tokenValue]: [string, string | undefined]) => tokenValue !== undefined)
          );
          state.explicitlyExposedTokens = tokensToExpose;
        }

        if (scope) {
          // Multiple scopes are passed and delimited by spaces,
          // despite using the singular name "scope".
          scopes = scope.split(' ');
          state.scopes = scopes;
        }

        localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(state));

        let accessContext: AccessContext = { token: accessToken, scopes };
        if (explicitlyExposedTokens) {
          accessContext.explicitlyExposedTokens = tokensToExpose;
        }
        return accessContext;
      })
      .catch(data => {
        const { onInvalidGrant } = this.config;
        const error = data.error || 'There was a network error.';
        switch (error) {
          case 'invalid_grant':
            onInvalidGrant(() => this.fetchAuthorizationCode());
            break;
          default:
            break;
        }
        return Promise.reject(toErrorClass(error));
      });
  }

  private recoverState(): State {
    const s = localStorage.getItem(LOCALSTORAGE_STATE) || '{}';
    try {
      return JSON.parse(s);
    } catch {
      return this.reset()
    }
  }

  private setState(state: State) {
    localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(state));
  }

  /**
   * Implements *base64url-encode* (RFC 4648 § 5) without padding, which is NOT
   * the same as regular base64 encoding.
   */
  static base64urlEncode(value: string): string {
    let base64 = btoa(value);
    base64 = base64.replace(/\+/g, '-');
    base64 = base64.replace(/\//g, '_');
    base64 = base64.replace(/=/g, '');
    return base64;
  }

  /**
   * Checks to see if the access token has expired.
   */
  static isAccessTokenExpired(accessToken?: AccessToken): boolean {
    return Boolean(!accessToken || (new Date()) >= (new Date(accessToken.expiry)));
  }

  /**
   * Extracts a query string parameter.
   */
  static extractParamFromUrl(url: string, param: string): string {
    const urlParts = url.split('?');
    if (urlParts.length >= 2) {
      const queryString = urlParts[1].split('#')[0];
      for (const kvPair of queryString.split('&')) {
        const [key, value] = kvPair.split('=')
        if (key === param) {
          return decodeURIComponent(value ?? '')
        }
      }
    }
    return ''
  }

  /**
   * Converts the keys and values of an object to a url query string
   */
  static objectToQueryString(dict: ObjStringDict): string {
    return Object
      .entries(dict)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Generates a code_verifier and code_challenge, as specified in rfc7636.
   */
  static async generatePKCECodes() {
    const output = crypto.getRandomValues(new Uint32Array(RECOMMENDED_CODE_VERIFIER_LENGTH));
    const codeVerifier = OAuth2AuthCodePKCE.base64urlEncode(Array
      .from(output)
      .map((n) => PKCE_CHARSET[n % PKCE_CHARSET.length])
      .join('')
    );
    const buffer = await crypto.subtle.digest('SHA-256', (new TextEncoder()).encode(codeVerifier))
    const hash = new Uint8Array(buffer);
    const hashLength = hash.byteLength;
    let binary = '';
    for (let i: number = 0; i < hashLength; i++) {
      binary += String.fromCharCode(hash[i]);
    }
    const codeChallenge = OAuth2AuthCodePKCE.base64urlEncode(binary)
    return { codeChallenge, codeVerifier };
  }

  /**
   * Generates random state to be passed for anti-csrf.
   */
  static generateRandomState(lengthOfState: number): string {
    const output = crypto.getRandomValues(new Uint32Array(lengthOfState));
    return Array
      .from(output)
      .map((n) => PKCE_CHARSET[n % PKCE_CHARSET.length])
      .join('');
  }
}
