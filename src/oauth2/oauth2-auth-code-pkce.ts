/**
 * An implementation of rfc6749#section-4.1 and rfc7636.
 *
 * Derived from https://github.com/BitySA/oauth2-auth-code-pkce
 */

export interface Configuration {
  authorizationUrl: URL;
  clientId: string;
  fetchTimeout: number,
  explicitlyExposedTokens?: string[];
  onAccessTokenExpiry: (refreshAccessToken: () => Promise<AccessContext>) => Promise<AccessContext>;
  onInvalidGrant: (refreshAuthCodeOrRefreshToken: () => Promise<never>) => void;
  redirectUrl: URL;
  scopes: string[];
  tokenUrl: URL;
  extraAuthorizationParams?: ObjStringDict;
  extraRefreshParams?: ObjStringDict;
}

export interface PKCECodes {
  codeChallenge: string;
  codeVerifier: string;
}

export interface State {
  accessToken?: AccessToken;
  authorizationCode?: string;
  codeChallenge?: string;
  codeVerifier?: string;
  explicitlyExposedTokens?: ObjStringDict;
  refreshToken?: RefreshToken;
  stateQueryParam?: string;
  scopes?: string[];
}

export interface RefreshToken {
  value: string;
};

export interface AccessToken {
  value: string;
  expiry: string;
};

export type Scopes = string[];

export interface AccessContext {
  token?: AccessToken;
  explicitlyExposedTokens?: ObjStringDict;
  scopes?: Scopes;
  refreshToken?: RefreshToken;
};

export type ObjStringDict = { [_: string]: string };
export type HttpClient = ((...args: any[]) => Promise<any>);
export type URL = string;

/**
 * A list of OAuth2AuthCodePKCE errors.
 */
// To "namespace" all errors.
export class ErrorOAuth2 { toString(): string { return 'ErrorOAuth2'; } }

// For really unknown errors.
export class ErrorUnknown extends ErrorOAuth2 { toString(): string { return 'ErrorUnknown'; } }

// Some generic, internal errors that can happen.
export class ErrorNoAuthCode extends ErrorOAuth2 { toString(): string { return 'ErrorNoAuthCode'; } }
export class ErrorInvalidReturnedStateParam extends ErrorOAuth2 { toString(): string { return 'ErrorInvalidReturnedStateParam'; } }
export class ErrorInvalidJson extends ErrorOAuth2 { toString(): string { return 'ErrorInvalidJson'; } }

// Errors that occur across many endpoints
export class ErrorInvalidScope extends ErrorOAuth2 { toString(): string { return 'ErrorInvalidScope'; } }
export class ErrorInvalidRequest extends ErrorOAuth2 { toString(): string { return 'ErrorInvalidRequest'; } }
export class ErrorInvalidToken extends ErrorOAuth2 { toString(): string { return 'ErrorInvalidToken'; } }

/**
 * Possible authorization grant errors given by the redirection from the
 * authorization server.
 */
export class ErrorAuthenticationGrant extends ErrorOAuth2 { toString(): string { return 'ErrorAuthenticationGrant'; } }
export class ErrorUnauthorizedClient extends ErrorAuthenticationGrant { toString(): string { return 'ErrorUnauthorizedClient'; } }
export class ErrorAccessDenied extends ErrorAuthenticationGrant { toString(): string { return 'ErrorAccessDenied'; } }
export class ErrorUnsupportedResponseType extends ErrorAuthenticationGrant { toString(): string { return 'ErrorUnsupportedResponseType'; } }
export class ErrorServerError extends ErrorAuthenticationGrant { toString(): string { return 'ErrorServerError'; } }
export class ErrorTemporarilyUnavailable extends ErrorAuthenticationGrant { toString(): string { return 'ErrorTemporarilyUnavailable'; } }

/**
 * A list of possible access token response errors.
 */
export class ErrorAccessTokenResponse extends ErrorOAuth2 { toString(): string { return 'ErrorAccessTokenResponse'; } }
export class ErrorInvalidClient extends ErrorAccessTokenResponse { toString(): string { return 'ErrorInvalidClient'; } }
export class ErrorInvalidGrant extends ErrorAccessTokenResponse { toString(): string { return 'ErrorInvalidGrant'; } }
export class ErrorUnsupportedGrantType extends ErrorAccessTokenResponse { toString(): string { return 'ErrorUnsupportedGrantType'; } }

/**
 * WWW-Authenticate error object structure for less error prone handling.
 */
export class ErrorWWWAuthenticate {
  public realm: string = "";
  public error: string = "";
}

export const RawErrorToErrorClassMap: { [_: string]: any } = {
  invalid_request: ErrorInvalidRequest,
  invalid_grant: ErrorInvalidGrant,
  unauthorized_client: ErrorUnauthorizedClient,
  access_denied: ErrorAccessDenied,
  unsupported_response_type: ErrorUnsupportedResponseType,
  invalid_scope: ErrorInvalidScope,
  server_error: ErrorServerError,
  temporarily_unavailable: ErrorTemporarilyUnavailable,
  invalid_client: ErrorInvalidClient,
  unsupported_grant_type: ErrorUnsupportedGrantType,
  invalid_json: ErrorInvalidJson,
  invalid_token: ErrorInvalidToken,
};

/**
 * Translate the raw error strings returned from the server into error classes.
 */
export function toErrorClass(rawError: string): ErrorOAuth2 {
  return new (RawErrorToErrorClassMap[rawError] || ErrorUnknown)();
}

/**
 * A convience function to turn, for example, `Bearer realm="bity.com", 
 * error="invalid_client"` into `{ realm: "bity.com", error: "invalid_client"
 * }`.
 */
export function fromWWWAuthenticateHeaderStringToObject(
  a: string
): ErrorWWWAuthenticate {
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
  private config!: Configuration;
  private state: State = {};
  private authorizationCodeForAccessTokenRequest?: Promise<AccessContext>;

  constructor(config: Configuration) {
    this.config = config;
    this.recoverState();
    return this;
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

    const code = OAuth2AuthCodePKCE.extractParamFromUrl(location.href, 'code');
    if (!code) {
      return false;
    }

    const state = JSON.parse(localStorage.getItem(LOCALSTORAGE_STATE) || '{}');

    const stateQueryParam = OAuth2AuthCodePKCE.extractParamFromUrl(location.href, 'state');
    if (stateQueryParam !== state.stateQueryParam) {
      console.warn("state query string parameter doesn't match the one sent! Possible malicious activity somewhere.");
      throw new ErrorInvalidReturnedStateParam();
    }

    state.authorizationCode = code;
    this.setState(state);
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
  public async fetchAuthorizationCode(oneTimeParams?: ObjStringDict): Promise<never> {
    this.assertStateAndConfigArePresent();

    const { clientId, extraAuthorizationParams, redirectUrl, scopes } = this.config;
    const { codeChallenge, codeVerifier } = await OAuth2AuthCodePKCE
      .generatePKCECodes();
    const stateQueryParam = OAuth2AuthCodePKCE
      .generateRandomState(RECOMMENDED_STATE_LENGTH);

    this.state = {
      ...this.state,
      codeChallenge,
      codeVerifier,
      stateQueryParam,
    };

    localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(this.state));

    let url = this.config.authorizationUrl
      + `?response_type=code&`
      + `client_id=${encodeURIComponent(clientId)}&`
      + `redirect_uri=${encodeURIComponent(redirectUrl)}&`
      + `scope=${encodeURIComponent(scopes.join(' '))}&`
      + `state=${stateQueryParam}&`
      + `code_challenge=${encodeURIComponent(codeChallenge)}&`
      + `code_challenge_method=S256`;

    if (extraAuthorizationParams || oneTimeParams) {
      const extraParameters: ObjStringDict = {
        ...extraAuthorizationParams,
        ...oneTimeParams
      };

      url = `${url}&${OAuth2AuthCodePKCE.objectToQueryString(extraParameters)}`
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
    // TODO: This reads the current state from the local storage,
    // which fixes the most annoying problems when two instances of
    // the app run together and update the current state. A real fix
    // would be to use indexedDB to store the state, and perform every
    // state change in a transaction.
    this.recoverState()

    this.assertStateAndConfigArePresent();

    const { onAccessTokenExpiry } = this.config;
    const {
      accessToken,
      authorizationCode,
      explicitlyExposedTokens,
      refreshToken,
      scopes
    } = this.state;

    // We use `this.authorizationCodeForAccessTokenRequest` to allow
    // several parallel `getAccessToken()` calls to reuse the same
    // promise, instead of making multiple requests to the auth server
    // (of which only the first would successfully obtain a
    // token). TODO: we probably have to use the same trick when using
    // the refresh token.
    if (this.authorizationCodeForAccessTokenRequest) {
      return this.authorizationCodeForAccessTokenRequest;
    }

    if (authorizationCode) {
      this.authorizationCodeForAccessTokenRequest = this.exchangeAuthorizationCodeForAccessToken();
      return this.authorizationCodeForAccessTokenRequest;
    }

    // Depending on the server (and config), refreshToken may not be available.
    if (refreshToken && this.isAccessTokenExpired()) {
      return onAccessTokenExpiry(() => this.exchangeRefreshTokenForAccessToken());
    }

    return Promise.resolve({
      token: accessToken,
      explicitlyExposedTokens,
      scopes,
      refreshToken
    });
  }

  /**
   * Refresh an access token from the remote service.
   */
  public exchangeRefreshTokenForAccessToken(): Promise<AccessContext> {
    this.assertStateAndConfigArePresent();

    const { extraRefreshParams, clientId, tokenUrl } = this.config;
    const { refreshToken } = this.state;

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
        this.state.accessToken = accessToken;

        if (refresh_token) {
          const refreshToken: RefreshToken = {
            value: refresh_token
          };
          this.state.refreshToken = refreshToken;
        }

        if (explicitlyExposedTokens) {
          tokensToExpose = Object.fromEntries(
            explicitlyExposedTokens
              .map((tokenName: string): [string, string | undefined] => [tokenName, json[tokenName]])
              .filter(([_, tokenValue]: [string, string | undefined]) => tokenValue !== undefined)
          );
          this.state.explicitlyExposedTokens = tokensToExpose;
        }

        if (scope) {
          // Multiple scopes are passed and delimited by spaces,
          // despite using the singular name "scope".
          scopes = scope.split(' ');
          this.state.scopes = scopes;
        }

        localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(this.state));

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

  /**
   * Get the scopes that were granted by the authorization server.
   */
  public getGrantedScopes(): Scopes | undefined {
    return this.state.scopes;
  }

  /**
   * Tells if the client is authorized or not. This means the client has at
   * least once successfully fetched an access token. The access token could be
   * expired.
   */
  public isAuthorized(): boolean {
    return !!this.state.accessToken;
  }

  /**
   * Checks to see if the access token has expired.
   */
  public isAccessTokenExpired(): boolean {
    const { accessToken } = this.state;
    return Boolean(!accessToken || (new Date()) >= (new Date(accessToken.expiry)));
  }

  public invalidateAccessToken(tokenValue: string) {
    this.recoverState()
    const state = this.state
    if (state.accessToken?.value === tokenValue) {
      state.accessToken = undefined
    }
    this.setState(state)
  }

  /**
   * Resets the state of the client. Equivalent to "logging out" the user.
   */
  public reset() {
    this.setState({});
    this.authorizationCodeForAccessTokenRequest = undefined;
  }

  /**
   * If the state or config are missing, it means the client is in a bad state.
   * This should never happen, but the check is there just in case.
   */
  private assertStateAndConfigArePresent() {
    if (!this.state || !this.config) {
      console.error('state:', this.state, 'config:', this.config);
      throw new Error('state or config is not set.');
    }
  }

  /**
   * Fetch an access token from the remote service. You may pass a custom
   * authorization grant code for any reason, but this is non-standard usage.
   */
  private async exchangeAuthorizationCodeForAccessToken(): Promise<AccessContext> {
    const { authorizationCode, codeVerifier } = this.state;
    const { clientId, onInvalidGrant, redirectUrl, explicitlyExposedTokens } = this.config;

    const body = `grant_type=authorization_code&`
      + `code=${encodeURIComponent(authorizationCode || '')}&`
      + `redirect_uri=${encodeURIComponent(redirectUrl)}&`
      + `client_id=${encodeURIComponent(clientId)}&`
      + `code_verifier=${codeVerifier || ''}`;

    const response = await fetchWithTimeout(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: this.config.fetchTimeout,
      body,
    });

    this.state.authorizationCode = undefined;
    this.authorizationCodeForAccessTokenRequest = undefined;
    this.state.codeChallenge = undefined;
    this.state.codeVerifier = undefined;
    this.state.stateQueryParam = undefined;

    if (!response.ok) {
      localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(this.state));

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

      this.state = {
        ...this.state,
        accessToken: {
          value: String(access_token),
          expiry: (new Date(Date.now() + (Number(expires_in) * 1000))).toString(),
        },
        refreshToken: refresh_token ? { value: String(refresh_token) } : undefined,
        scopes: scope ? String(scope).split(' ') : undefined,
        explicitlyExposedTokens: explicitlyExposedTokens ? extractTokens(explicitlyExposedTokens) : undefined,
      }

    } finally {
      localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(this.state));
    }

    return {
      token: this.state.accessToken,
      scopes: this.state.scopes,
      explicitlyExposedTokens: this.state.explicitlyExposedTokens,
    };
  }

  private recoverState(): this {
    this.state = JSON.parse(localStorage.getItem(LOCALSTORAGE_STATE) || '{}');
    return this;
  }

  private setState(state: State): this {
    this.state = state;
    localStorage.setItem(LOCALSTORAGE_STATE, JSON.stringify(state));
    return this;
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
   * Extracts a query string parameter.
   */
  static extractParamFromUrl(url: URL, param: string): string {
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
    return Object.entries(dict).map(
      ([key, val]: [string, string]) => `${key}=${encodeURIComponent(val)}`
    ).join('&');
  }

  /**
   * Generates a code_verifier and code_challenge, as specified in rfc7636.
   */
  static async generatePKCECodes(): Promise<PKCECodes> {
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
    const output = new Uint32Array(lengthOfState);
    crypto.getRandomValues(output);
    return Array
      .from(output)
      .map((num: number) => PKCE_CHARSET[num % PKCE_CHARSET.length])
      .join('');
  }
}
