import validate from '../src/debtor-info/validate-schema.js'
import { generateCoinInfoDocument, parseDebtorInfoDocument, InvalidDocument } from '../src/debtor-info'

test("Validate CoinInfo schema", () => {
  expect(validate(1)).toEqual(false)
  expect(validate(null)).toEqual(false)
  expect(validate([])).toEqual(false)
  expect(validate({})).toEqual(false)
  expect(validate({ 'type': 'CoinInfo' })).toEqual(false)
  let data = {
    type: 'CoinInfo-v1',
    uri: 'https://example.com/0',
    revision: 0,
    willNotChangeUntil: '2021-01-01T10:00:00Z',
    latestDebtorInfo: { uri: 'http://example.com/' },
    summary: "bla-bla",
    debtorIdentity: { type: 'DebtorIdentity', uri: 'swpt:123' },
    debtorName: 'USA',
    debtorHomepage: { uri: 'https://example.com/USA' },
    amountDivisor: 100.0,
    decimalPlaces: 2,
    unit: 'USD',
    peg: {
      type: 'Peg',
      exchangeRate: 1.0,
      debtorIdentity: { type: 'DebtorIdentity', uri: 'swpt:321' },
      latestDebtorInfo: { uri: 'http://example.com/' },
    },
    unknownProp: 1,
  }
  expect(validate(data)).toEqual(true)
  expect(validate({ ...data, peg: undefined })).toEqual(true)
  expect(validate({ ...data, type: 'INVALID' })).toEqual(false)
  expect(validate.errors).toEqual([{
    "instancePath": "/type",
    "schemaPath": "#/properties/type/pattern",
    "keyword": "pattern",
    "params": { "pattern": "^CoinInfo(-v[1-9][0-9]{0,5})?$" },
    "message": "must match pattern \"^CoinInfo(-v[1-9][0-9]{0,5})?$\"",
  }])
})

test("Generate and parse CoinInfo document", async () => {
  const debtorData = {
    uri: 'https://example.com/0',
    revision: 0,
    willNotChangeUntil: new Date('2021-01-01T10:00:00Z'),
    latestDebtorInfo: { uri: 'http://example.com/' },
    summary: "bla-bla",
    debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:123' },
    debtorName: 'USA',
    debtorHomepage: { uri: 'https://example.com/USA' },
    amountDivisor: 100.0,
    decimalPlaces: 2,
    unit: 'USD',
    peg: {
      type: 'Peg' as const,
      exchangeRate: 1.0,
      debtorIdentity: { type: 'DebtorIdentity' as const, uri: 'swpt:321' },
      latestDebtorInfo: { uri: 'http://example.com/' },
    },
    unknownProp: 1,
  }
  const document = await generateCoinInfoDocument(debtorData)
  const { unknownProp, ...noUnknownProps } = debtorData
  await expect(parseDebtorInfoDocument(document)).resolves.toEqual(noUnknownProps)
  await expect(generateCoinInfoDocument({ ...debtorData, revision: -1 }))
    .rejects.toBeInstanceOf(InvalidDocument)
  await expect(generateCoinInfoDocument({ ...debtorData, willNotChangeUntil: new Date(NaN) }))
    .rejects.toBeInstanceOf(InvalidDocument)
})
