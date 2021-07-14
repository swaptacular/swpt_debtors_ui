/* The file `validate-schema.js` can be automatically generated from
 * the `schema.json` file by running the following commands:
 *
 * $ npx ajv compile -s schema.json -o validate-schema.js --strict=true
 * $ sed -i 's/require("ajv\/dist\/runtime\/ucs2length")/require(".\/ucs2length.js")/g' validate-schema.js
 */

declare type ValidationError = {
  instancePath: string,
  schemaPath: string,
  keyword: string,
  params: any,
  message: string,
}

declare const validate: {
  (value: any): boolean,
  errors: ValidationError[],
}
export default validate
