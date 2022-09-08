+++++++++++++++++++++++++++++++++++
``CoinInfo`` JSON Documents
+++++++++++++++++++++++++++++++++++
:Description: Specifies the format for CoinInfo documents.
:Author: Evgeni Pandurksi
:Contact: epandurski@gmail.com
:Date: 2022-09-07
:Version: 1.0
:Copyright: This document has been placed in the public domain.


Overview
========

This document specifies the format for ``CoinInfo`` documents.

In `Swaptacular`_, each digital coin contains a link to a debtor info
document. The ``CoinInfo`` document format, specified here, is one of
the standard formats that can be used to specify debtor
information. Note that in Swaptacular's terminology, the word "debtor"
means a Swaptacular currency, with its respective issuer.

**Note:** The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
"SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
RFC 2119.


MIME Type
=========

Over HTTP connections, ``CoinInfo`` documents MUST be transferred with
``application/vnd.swaptacular.coin-info+json`` `MIME type`_.


JSON Schema
===========

``CoinInfo`` documents are `JSON`_ documents whose structure and
content can be correctly validated by the `JSON Schema`_ specified
here:

Type: ``object``

path: #

This schema accepts additional properties.

Properties
==========

- **type** ``required``

  - Type: ``string``
  - path: #/properties/type
  - The value MUST match this pattern: ``^CoinInfo(-v[1-9][0-9]{0,5})?$``

- **revision** ``required``

  The revision number. Later revisions SHOULD have bigger revision
  numbers.

  - Type: ``integer``
  - path: #/properties/revision
  - Range: between 0 and 2147483647

- **willNotChangeUntil**

  Optional promise that, until the specified moment, there will be no
  new revisions of this document.

  - Type: ``string``
  - path: #/properties/willNotChangeUntil
  - String format MUST be a "date-time" (ISO 8601 format)
  - Length:  <= 100

- **latestDebtorInfo** ``required``

  A link to the newest revision of this currency's debtor info
  document. (Most probably, a link to the newest revision of this
  document.)

  - path: #/properties/latestDebtorInfo
  - &ref: `#/definitions/ShortLink`_

- **summary**

  A short description of the currency.

  - Type: ``string``
  - path: #/properties/summary
  - Length:  <= 500

- **debtorIdentity** ``required``

  Uniquely identifies the debtor (and the currency). Note that in
  Swaptacular's terminology, the word "debtor" means a Swaptacular
  currency with its respective issuer. Therefore, if single issuer (a
  person or organization) issues multiple currencies, he/she will
  represent multiple different "debtors".

  - path: #/properties/debtorIdentity
  - &ref: `#/definitions/DebtorIdentity`_

- **debtorName** ``required``

  The name of the debtor. SHOULD be unambiguous, easy to remember,
  and unlikely to be duplicated accidentally. Different currencies
  SHOULD have different ``debtorName``s, even when they are issued by
  the same person or organization.

  - Type: ``string``
  - path: #/properties/debtorName
  - Length: between 1 and 40

- **debtorHomepage**

  Optional link to the debtor's homepage.

  - path: #/properties/debtorHomepage
  - &ref: `#/definitions/ShortLink`_

- **amountDivisor** ``required``

  Before displaying the amount, it should be divided by this
  number. This value should be used for display purposes
  only. Notably, the value of this field must be ignored when the
  exchange rate between pegged currencies is calculated. This field
  SHOULD NOT change in newer revisions of the document.

  - Type: ``number``
  - path: #/properties/amountDivisor
  - Exclusive Range:  > 0

- **decimalPlaces** ``required``

  The number of digits to show after the decimal point, when
  displaying the amount. A negative number signifies the number of
  insignificant digits at the end of the integer number. This field
  SHOULD NOT change in newer revisions of the document.

  - Type: ``integer``
  - path: #/properties/decimalPlaces
  - Range: between -20 and 20

- **unit** ``required``

  The value measurement unit. It should be shown right after the
  displayed amount, "500.00 USD" for example. This field SHOULD NOT
  change in newer revisions of the document.

  - Type: ``string``
  - path: #/properties/unit
  - Length: between 1 and 40

- **peg**

  Optional currency peg. A currency peg is a currency management
  strategy in which the issuer sets a specific fixed exchange rate
  between the tokens of his currency (the pegged currency) and the
  tokens of some other currency (the peg currency).

  - path: #/properties/peg
  - &ref: `#/definitions/Peg`_


Definitions
===========


.. _`#/definitions/ShortLink`:

``ShortLink``
-------------

Type: ``object``

path: #/definitions/ShortLink

This schema does not accept additional properties.

Properties
``````````

- **uri** ``required``

  The IRI (Internationalized Resource Identifier) of the referenced
  resource. MUST be an absolute IRI.

  - Type: ``string``
  - path: #/definitions/ShortLink/properties/uri
  - String format MUST be a "iri"
  - Length:  <= 200



.. _`#/definitions/DebtorIdentity`:

``DebtorIdentity``
------------------

Type: ``object``

path: #/definitions/DebtorIdentity

This schema accepts additional properties.

Properties
``````````

- **type** ``required``

  - Type: ``string``
  - path: #/definitions/DebtorIdentity/properties/type
  - The value MUST match this pattern: ``^DebtorIdentity(-v[1-9][0-9]{0,5})?$``

- **uri** ``required``

  The information contained in this field MUST be enough to uniquely
  and reliably identify the debtor (and the currency). Note that a
  network request MUST NOT be needed to identify the debtor. For
  example, if the issuer happens to be a bank, the URI would reveal
  the type of the issuer (a bank), the ID of the bank, and the
  currency code (USD for example). Note that some debtors may be used
  only to represent a physical value measurement unit (like ounces of
  gold). Those dummy debtors do not represent a person or an
  organization, do not owe anything to anyone, and are used solely as
  identifiers of value measurement units.

  - Type: ``string``
  - path: #/definitions/DebtorIdentity/properties/uri
  - String format MUST be a "uri"
  - Length:  <= 100


.. _`#/definitions/PegDisplay`:

``PegDisplay``
--------------

Type: ``object``

path: #/definitions/PegDisplay

This schema accepts additional properties.

Properties
``````````

- **type** ``required``

  - Type: ``string``
  - path: #/definitions/PegDisplay/properties/type
  - The value MUST match this pattern: ``^PegDisplay(-v[1-9][0-9]{0,5})?$``

- **amountDivisor** ``required``

  The peg currency's ``amountDivisor``.

  - Type: ``number``
  - path: #/definitions/PegDisplay/properties/amountDivisor
  - Exclusive Range:  > 0

- **decimalPlaces** ``required``

  The peg currency's ``decimalPlaces``.

  - Type: ``integer``
  - path: #/definitions/PegDisplay/properties/decimalPlaces
  - Range: between -20 and 20

- **unit** ``required``

  The peg currency's ``unit``.

  - Type: ``string``
  - path: #/definitions/PegDisplay/properties/unit
  - Length: between 1 and 40


.. _`#/definitions/Peg`:

``Peg``
-------

Type: ``object``

path: #/definitions/Peg

This schema accepts additional properties.

Properties
``````````

- **type** ``required``

  - Type: ``string``
  - path: #/definitions/Peg/properties/type
  - The value MUST match this pattern: ``^Peg(-v[1-9][0-9]{0,5})?$``

- **exchangeRate** ``required``

  The exchange rate between the pegged currency and the peg
  currency. For example, ``2.0`` would mean that pegged currency's
  tokens are twice as valuable as peg currency's tokens.

  - Type: ``number``
  - path: #/definitions/Peg/properties/exchangeRate
  - Range:  >= 0

- **display** ``required``

  Specifies peg currency's display parameters.

  - path: #/definitions/Peg/properties/display
  - &ref: `#/definitions/PegDisplay`_

- **debtorIdentity** ``required``

  Uniquely identifies the peg currency.

  - path: #/definitions/Peg/properties/debtorIdentity
  - &ref: `#/definitions/DebtorIdentity`_

- **latestDebtorInfo** ``required``

  A link to the newest revision of the peg currency's debtor info
  document (a ``CoinInfo`` document, for example).

  - path: #/definitions/Peg/properties/latestDebtorInfo
  - &ref: `#/definitions/ShortLink`_


JSON Schema File
================

This is the JSON Schema file, for validating ``CoinInfo`` documents::

 {
   "definitions": {
     "ShortLink": {
       "type": "object",
       "properties": {
         "uri": {
           "type": "string",
           "format": "iri",
           "maxLength": 200
          }
       },
       "required": [ "uri" ],
       "additionalProperties": false
     },
     "DebtorIdentity": {
       "type": "object",
       "properties": {
         "type":  {
           "type": "string",
           "pattern": "^DebtorIdentity(-v[1-9][0-9]{0,5})?$"
         },
         "uri": {
           "type": "string",
           "format": "uri",
           "maxLength": 100
         }
       },
       "required": [ "type", "uri" ],
       "additionalProperties": true
     },
     "PegDisplay": {
       "type": "object",
       "properties": {
         "type":  {
           "type": "string",
           "pattern": "^PegDisplay(-v[1-9][0-9]{0,5})?$"
         },
         "amountDivisor": {
           "type": "number",
           "format": "double",
           "exclusiveMinimum": 0.0
         },
         "decimalPlaces": {
           "type": "integer",
           "format": "int32",
           "minimum": -20,
           "maximum": 20
         },
         "unit": {
           "type": "string",
           "minLength": 1,
           "maxLength": 40
         }
       },
       "required": [
         "type",
         "amountDivisor",
         "decimalPlaces",
         "unit"
       ],
       "additionalProperties": true
     },
     "Peg": {
       "type": "object",
       "properties": {
         "type":  {
           "type": "string",
           "pattern": "^Peg(-v[1-9][0-9]{0,5})?$"
         },
         "exchangeRate": {
           "type": "number",
           "format": "double",
           "minimum": 0.0
         },
         "display": {
           "$ref": "#/definitions/PegDisplay"
         },
         "debtorIdentity": {
           "$ref": "#/definitions/DebtorIdentity"
         },
         "latestDebtorInfo": {
           "$ref": "#/definitions/ShortLink"
         }
       },
       "required": [
         "type",
         "exchangeRate",
         "display",
         "debtorIdentity",
         "latestDebtorInfo",
       ],
       "additionalProperties": true
     }
   },  
   "type": "object",
   "properties": {
     "type":  {
       "type": "string",
       "pattern": "^CoinInfo(-v[1-9][0-9]{0,5})?$"
     },
     "revision": {
       "type": "integer",
       "format": "int32",
       "minimum": 0,
       "maximum": 2147483647
     },
     "willNotChangeUntil": {
       "type": "string",
       "format": "date-time",
       "maxLength": 100
     },
     "latestDebtorInfo": {
       "$ref": "#/definitions/ShortLink"
     },
     "summary": {
       "type": "string",
       "maxLength": 500
     },
     "debtorIdentity": {
       "$ref": "#/definitions/DebtorIdentity"
     },
     "debtorName": {
       "type": "string",
       "minLength": 1,
       "maxLength": 40
     },
     "debtorHomepage": {
       "$ref": "#/definitions/ShortLink"
     },
     "amountDivisor": {
       "type": "number",
       "format": "double",
       "exclusiveMinimum": 0.0
 },
     "decimalPlaces": {
       "type": "integer",
       "format": "int32",
       "minimum": -20,
       "maximum": 20
     },
     "unit": {
       "type": "string",
       "minLength": 1,
       "maxLength": 40
     },
     "peg":  {
       "$ref": "#/definitions/Peg"
     }
   },
   "required": [
     "type",
     "revision",
     "latestDebtorInfo",
     "debtorIdentity",
     "debtorName",
     "amountDivisor",
     "decimalPlaces",
     "unit"
   ],
   "additionalProperties": true
 }


.. _Swaptacular: https://swaptacular.github.io/overview
.. _MIME Type: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
.. _JSON: https://www.json.org/json-en.html
.. _JSON Schema: http://json-schema.org/
