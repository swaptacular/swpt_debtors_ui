import { OAuth2AuthCodePKCE } from '../src/oauth2/oauth2-auth-code-pkce.js'

test("Extract parameter from URL", () => {
  const value = OAuth2AuthCodePKCE.extractParamFromUrl('https://example.com?value1=key1&key1=value1', 'key1')
  expect(value).toBe('value1')
})
