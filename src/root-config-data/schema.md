Type: `object`

<i id="#">path: #</i>

This schema accepts additional properties.

**_Properties_**

 - <b id="#/properties/type">type</b>
	 - Type: `string`
	 - <i id="#/properties/type">path: #/properties/type</i>
	 - The value must match this pattern: `^RootConfigData(-v[1-9][0-9]{0,5})?$`
 - <b id="#/properties/rate">rate</b>
	 - _Annual rate (in percents) at which interest accumulates on creditors' accounts._
	 - Type: `number`
	 - <i id="#/properties/rate">path: #/properties/rate</i>
 - <b id="#/properties/info">info</b>
	 - _Additional information about the debtor._
	 - <i id="#/properties/info">path: #/properties/info</i>
	 - &#36;ref: [#/definitions/DebtorInfo](#/definitions/DebtorInfo)
# definitions

**_DebtorInfo_**

 - Type: `object`
 - <i id="#/definitions/DebtorInfo">path: #/definitions/DebtorInfo</i>
 - This schema accepts additional properties.
 - **_Properties_**
	 - <b id="#/definitions/DebtorInfo/properties/type">type</b>
		 - Type: `string`
		 - <i id="#/definitions/DebtorInfo/properties/type">path: #/definitions/DebtorInfo/properties/type</i>
		 - The value must match this pattern: `^DebtorInfo(-v[1-9][0-9]{0,5})?$`
	 - <b id="#/definitions/DebtorInfo/properties/iri">iri</b> `required`
		 - _A link (Internationalized Resource Identifier) referring to a document containing information about the debtor._
		 - Type: `string`
		 - <i id="#/definitions/DebtorInfo/properties/iri">path: #/definitions/DebtorInfo/properties/iri</i>
		 - String format must be a "iri"
		 - Length: between 1 and 200
	 - <b id="#/definitions/DebtorInfo/properties/contentType">contentType</b>
		 - _Optional MIME type of the document that the `iri` field refers to._
		 - Type: `string`
		 - <i id="#/definitions/DebtorInfo/properties/contentType">path: #/definitions/DebtorInfo/properties/contentType</i>
		 - Length:  &le; 100
	 - <b id="#/definitions/DebtorInfo/properties/sha256">sha256</b>
		 - _Optional SHA-256 cryptographic hash (Base16 encoded) of the content of the document that the `iri` field refers to._
		 - Type: `string`
		 - <i id="#/definitions/DebtorInfo/properties/sha256">path: #/definitions/DebtorInfo/properties/sha256</i>
		 - The value must match this pattern: `^[0-9A-F]{64}$`



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_