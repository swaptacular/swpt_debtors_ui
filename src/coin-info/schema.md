Type: `object`

<i id="#">path: #</i>

This schema accepts additional properties.

**_Properties_**

 - <b id="#/properties/type">type</b> `required`
	 - Type: `string`
	 - <i id="#/properties/type">path: #/properties/type</i>
	 - The value must match this pattern: `^CoinInfo(-v[1-9][0-9]{0,5})?$`
 - <b id="#/properties/uri">uri</b> `required`
	 - _The IRI (Internationalized Resource Identifier) of this object. Must be an absolute IRI._
	 - Type: `string`
	 - <i id="#/properties/uri">path: #/properties/uri</i>
	 - String format must be a "iri"
	 - Length: between 1 and 200
 - <b id="#/properties/revision">revision</b> `required`
	 - _The revision number. Later revisions must have bigger revision numbers._
	 - Type: `integer`
	 - <i id="#/properties/revision">path: #/properties/revision</i>
	 - Range: between 0 and 2147483647
 - <b id="#/properties/willNotChangeUntil">willNotChangeUntil</b>
	 - _Optional promise that, until the specified moment (in ISO 8601 format), there will be no new revisions of this document._
	 - Type: `string`
	 - <i id="#/properties/willNotChangeUntil">path: #/properties/willNotChangeUntil</i>
	 - String format must be a "date-time"
	 - Length:  &le; 100
 - <b id="#/properties/latestCoinInfo">latestCoinInfo</b> `required`
	 - _A link to the newest revision of this document._
	 - <i id="#/properties/latestCoinInfo">path: #/properties/latestCoinInfo</i>
	 - &#36;ref: [#/definitions/ResourceReference](#/definitions/ResourceReference)
 - <b id="#/properties/summary">summary</b>
	 - _A short description of the currency._
	 - Type: `string`
	 - <i id="#/properties/summary">path: #/properties/summary</i>
	 - Length:  &le; 1000
 - <b id="#/properties/debtorIdentity">debtorIdentity</b> `required`
	 - _Uniquely identifies the debtor (and the currency)._
	 - <i id="#/properties/debtorIdentity">path: #/properties/debtorIdentity</i>
	 - &#36;ref: [#/definitions/DebtorIdentity](#/definitions/DebtorIdentity)
 - <b id="#/properties/debtorName">debtorName</b> `required`
	 - _The name of the debtor. Should be unambiguous and easy to remember._
	 - Type: `string`
	 - <i id="#/properties/debtorName">path: #/properties/debtorName</i>
	 - Length: between 1 and 40
 - <b id="#/properties/debtorHomepage">debtorHomepage</b>
	 - _Optional link to the debtor's homepage._
	 - <i id="#/properties/debtorHomepage">path: #/properties/debtorHomepage</i>
	 - &#36;ref: [#/definitions/ResourceReference](#/definitions/ResourceReference)
 - <b id="#/properties/amountDevisor">amountDevisor</b> `required`
	 - _Before displaying the amount, it should be divided by this number. This value should be used for display purposes only. Notably, the value of this field must be ignored when the exchange rate between pegged currencies is calculated._
	 - Type: `number`
	 - <i id="#/properties/amountDevisor">path: #/properties/amountDevisor</i>
	 - Range:  &ge; 0
 - <b id="#/properties/decimalPlaces">decimalPlaces</b> `required`
	 - _The number of digits to show after the decimal point, when displaying the amount. A negative number signifies the number of insignificant digits at the end of the integer number._
	 - Type: `integer`
	 - <i id="#/properties/decimalPlaces">path: #/properties/decimalPlaces</i>
	 - Range: between -20 and 20
 - <b id="#/properties/unit">unit</b> `required`
	 - _The value measurement unit. It should be shown right after the displayed amount, "500.00 USD" for example._
	 - Type: `string`
	 - <i id="#/properties/unit">path: #/properties/unit</i>
	 - Length: between 1 and 40
 - <b id="#/properties/peg">peg</b>
	 - _Optional currency peg. A currency peg is a currency management strategy in which the debtor sets a specific fixed exchange rate between the tokens of his currency (the pegged currency) and the tokens of some other currency (the peg currency)._
	 - <i id="#/properties/peg">path: #/properties/peg</i>
	 - &#36;ref: [#/definitions/CoinPeg](#/definitions/CoinPeg)
# definitions

**_ResourceReference_**

 - Type: `object`
 - <i id="#/definitions/ResourceReference">path: #/definitions/ResourceReference</i>
 - **_Properties_**
	 - <b id="#/definitions/ResourceReference/properties/uri">uri</b> `required`
		 - _The IRI (Internationalized Resource Identifier) of the referenced resource. Can be a relative IRI._
		 - Type: `string`
		 - <i id="#/definitions/ResourceReference/properties/uri">path: #/definitions/ResourceReference/properties/uri</i>
		 - String format must be a "iri-reference"
		 - Length:  &le; 1000


**_DebtorIdentity_**

 - Type: `object`
 - <i id="#/definitions/DebtorIdentity">path: #/definitions/DebtorIdentity</i>
 - **_Properties_**
	 - <b id="#/definitions/DebtorIdentity/properties/type">type</b> `required`
		 - <i id="#/definitions/DebtorIdentity/properties/type">path: #/definitions/DebtorIdentity/properties/type</i>
	 - <b id="#/definitions/DebtorIdentity/properties/uri">uri</b> `required`
		 - _The information contained in this field must be enough to uniquely and reliably identify the debtor. Note that a network request should not be needed to identify the debtor. For example, if the debtor happens to be a bank, the URI would reveal the type of the debtor (a bank), and the ID of the bank. Note that some debtors may be used only to represent a physical value measurement unit (like ounces of gold). Those dummy debtors do not represent a person or an organization, do not owe anything to anyone, and are used solely as identifiers of value measurement units._
		 - Type: `string`
		 - <i id="#/definitions/DebtorIdentity/properties/uri">path: #/definitions/DebtorIdentity/properties/uri</i>
		 - String format must be a "uri"
		 - Length:  &le; 100


**_CoinPeg_**

 - Type: `object`
 - <i id="#/definitions/CoinPeg">path: #/definitions/CoinPeg</i>
 - **_Properties_**
	 - <b id="#/definitions/CoinPeg/properties/type">type</b> `required`
		 - <i id="#/definitions/CoinPeg/properties/type">path: #/definitions/CoinPeg/properties/type</i>
	 - <b id="#/definitions/CoinPeg/properties/exchangeRate">exchangeRate</b> `required`
		 - _The exchange rate between the pegged currency and the peg currency. For example, `2.0` would mean that pegged currency's tokens are twice as valuable as peg currency's tokens._
		 - Type: `number`
		 - <i id="#/definitions/CoinPeg/properties/exchangeRate">path: #/definitions/CoinPeg/properties/exchangeRate</i>
		 - Range:  &ge; 0
	 - <b id="#/definitions/CoinPeg/properties/debtorIdentity">debtorIdentity</b> `required`
		 - _Uniquely identifies the peg currency._
		 - <i id="#/definitions/CoinPeg/properties/debtorIdentity">path: #/definitions/CoinPeg/properties/debtorIdentity</i>
		 - &#36;ref: [#/definitions/DebtorIdentity](#/definitions/DebtorIdentity)
	 - <b id="#/definitions/CoinPeg/properties/latestCoinInfo">latestCoinInfo</b> `required`
		 - _A link to the newest revision of the peg currency's `CoinInfo` document._
		 - <i id="#/definitions/CoinPeg/properties/latestCoinInfo">path: #/definitions/CoinPeg/properties/latestCoinInfo</i>
		 - &#36;ref: [#/definitions/ResourceReference](#/definitions/ResourceReference)



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_