import validate from '../src/root-config-data/validate-schema.js'
import { stringifyRootConfigData, parseRootConfigData, InvalidRootConfigData } from '../src/root-config-data'

test("Validate RootConfigData schema", () => {
  expect(validate(1)).toEqual(false)
  const data = {
    type: 'RootConfigData-v1',
    rate: 0,
    info: {
      type: 'DebtorInfo',
      iri: 'http://example.com',
      contentType: 'text/plain',
      sha256: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    },
    unknownProp: 1,
  }
  expect(validate(data)).toEqual(true)
  expect(validate({ ...data, info: undefined })).toEqual(true)
  expect(validate({ ...data, rate: 'string' })).toEqual(false)
  expect(validate.errors).toEqual([{
    "instancePath": "/rate",
    "schemaPath": "#/properties/rate/type",
    "keyword": "type",
    "params": { "type": "number" },
    "message": "must be number",
  }])
})

test("Stringify and parse RootConfigData document", async () => {
  const rootConfigData = {
    rate: 0,
    info: {
      iri: 'http://example.com',
      contentType: 'text/plain',
      sha256: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    },
    unknownProp: 1,
  }
  const document = stringifyRootConfigData(rootConfigData)
  const { unknownProp, ...noUnknownProps } = rootConfigData
  expect(parseRootConfigData(document)).toEqual(noUnknownProps)
  expect(() => stringifyRootConfigData({ ...rootConfigData, rate: "string" as any as number }))
    .toThrow(InvalidRootConfigData)
  expect(() => parseRootConfigData('{"rate": "string"}'))
    .toThrow(InvalidRootConfigData)
  expect(() => parseRootConfigData(''))
    .toThrow(InvalidRootConfigData)
})
