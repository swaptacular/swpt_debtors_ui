/* NOTE: The file `./validate-schema.js` is automatically generated
 * from the `./schema.json` file, by running the following command:
 *
 * $ npx ajv compile -s schema.json -o validate-schema.js --strict=true --remove-additional=all --validate-formats=false
 */
import validate from './validate-schema.js'

export type RootConfigData = {
  rate?: number,
  info?: {
    iri: string,
    contentType?: string,
    sha256?: string,  // For example: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
  }
}

export class InvalidRootConfigData extends Error {
  name = 'InvalidRootConfigData'
}

export function stringifyRootConfigData(rootConfigData: RootConfigData): string {
  const data: any = { ...rootConfigData, type: 'RootConfigData' }
  if (data.info) {
    data.info.type = 'DebtorInfo'
  }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidRootConfigData(`${e.instancePath} ${e.message}`)
  }
  return JSON.stringify(data)
}

export function parseRootConfigData(s: string): RootConfigData {
  let data
  try {
    data = JSON.parse(s)
  } catch {
    throw new InvalidRootConfigData('parse error')
  }
  if (!validate(data)) {
    const e = validate.errors[0]
    throw new InvalidRootConfigData(`${e.instancePath} ${e.message}`)
  }
  delete data.type
  if (data.info) {
    delete data.info.type
  }
  return data
}
