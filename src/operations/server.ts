import { ServerSession } from '../web-api'
export * from '../web-api'
export * from '../web-api-schemas'

export type RootConfigData = {
  type?: 'RootConfigData',
  rate: number,
  info: {
    type?: 'DebtorInfo',
    iri: string,
    contentType?: string,
    sha256?: string,  // For example: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
  }
}

export const server = new ServerSession({
  onLoginAttempt: async (login) => {
    if (confirm('This operation requires authentication. You will be redirected to the login page.')) {
      return await login()
    }
    return false
  }
})
