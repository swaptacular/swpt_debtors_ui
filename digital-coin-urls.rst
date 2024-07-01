++++++++++++++++++++++++++++
Digital Coins in Swaptacular
++++++++++++++++++++++++++++
:Description: Specifies the way digital coins work in Swaptacular
:Author: Evgeni Pandurksi
:Contact: epandurski@gmail.com
:Date: 2024-07-01
:Version: 1.1
:Copyright: This document has been placed in the public domain.


Overview
========

This document specifies the way *digital coins* work in Swaptacular.

In `Swaptacular`_\'s terminology, the word "debtor" means a
Swaptacular currency, with its respective issuer. A "digital coin" is
a specially formatted URL, which uniquely identifies a debtor (a
currency) in Swaptacular, and contains a reference to a document that
describes the currency.

**Note:** The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
"SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
RFC 2119.


Digital Coin
------------

The general form of a *digital coin* is::

  <debtor-info-locator>#<swpt-debtor-uri>

* ``<debtor-info-locator>`` is the `Debtor Info Locator`_ (see below).

* ``<swpt-debtor-uri>`` is an `URI`_ in the ``swpt`` URI
  scheme [#swpt-scheme]_, which uniquely identifies the debtor.

Example: ``https://example.com/foo/bar#swpt:6787514562``

Here the `URL`_ ``https://example.com/foo/bar`` is the `Debtor Info
Locator`_, and ``swpt:6787514562`` is the URI that uniquely identifies
the debtor.
  
**Note:** The preferred way to make digital coins available to
currency users is to present them as `QR Codes`_, whose textual
content consists of the respective digital coin. For the example given
above, the textual context of the corresponding QR Code will be:
``https://example.com/foo/bar#swpt:6787514562``.

.. [#swpt-scheme] The ``swpt`` URI scheme is defined in a separate
  document.

   

Debtor Info Locator
-------------------

"Debtor Info Locator" is an `HTTPS`_ URL, making a network request to
which, MUST either directly return [#HTTP-OK]_ an *immutable document*
that describes the currency, or `redirects`_ [#redirection]_ to a
different URL, from which an *immutable document* that describes the
currency can be retrieved. The retrieved document MUST be immutable.
[#immutable]_

All responses related to the "Debtor Info Locator" MUST be
`CORS`_-enabled and SHOULD include the ``Access-Control-Allow-Origin:
*`` HTTP header.

**Important note:** When the description of the currency changes, a
new immutable document (with a new URL) MUST be created, containing
the new description, and the currency's "Debtor Info Locator" MUST be
updated to redirect to the newly created (the latest) version of the
currency description document.


.. [#HTTP-OK] That is: Directly return an HTTP response, with response
  code ``200``, that contains an immutable document which describes
  the currency.

.. [#redirection] The redirection SHOULD use HTTP response code
  ``302``.

.. [#immutable] In this context, "immutable" means that later requests
  to the same URL, MUST return exactly the same document.


Debtor Info Documents
---------------------

In Swaptacular, a `machine-readable document`_ that describes a
currency is called a "Debtor Info Document". A multitude of standard
formats can be used for debtor info documents, which shall be defined
in their respective format specifications.

As an absolute minimum, every debtor info document MUST contain:

* the currency's `Debtor Info Locator`_,

* the ``swpt`` [#swpt-scheme]_ `URI`_ which uniquely identifies the
  debtor,

* the currency name.

Furthermore, debtor info documents SHOULD contain additional essential
information about the respective currency: the currency's display
parameters (like the currency unit abbreviation), the currency
description, optional fixed exchange rate with another currency, etc.


Verification of Digital Coins
-----------------------------

Debtor info documents SHOULD always be retrieved via cryptographically
secured connections, `HTTPS`_ for example. Although HTTPS (which is
REQUIRED for `Debtor Info Locator`_\s) gives a good level of security,
the information contained in a debtor info document is of such
critical importance, that its authenticity SHOULD be independently
verified before the user is allowed to receive payments in the
corresponding currency. The following verification procedure SHOULD be
followed:

1. If the user does not have an account with the debtor specified by
   ``<swpt-debtor-uri>`` already, the user's *creditors agent* should
   send a ``ConfigureAccount`` `Swaptacular Messaging Protocol`_
   message to the *accounting authority* responsible for the given
   debtor. This message instructs the accounting authority to create a
   new account with the given debtor.

2. If a new account with the given debtor **can not** be created, the
   verification attempt has failed, and the user will not be able to
   receive payments in the corresponding currency. [#no-connection]_

   Note however, that in this case, a "dummy" account with the given
   debtor can still be created for the user. Such a dummy account can
   only be used as `a peg`_ for currencies that have declared a fixed
   exchange rate with the given currency.

3. If an account with the given debtor has been successfully created,
   the user's *creditors agent* will receive an ``AccountUpdate``
   `Swaptacular Messaging Protocol`_ message from the *accounting
   authority* responsible for the debtor. The received message will
   contain the following fields: ``debtor_info_iri``,
   ``debtor_info_content_type``, and ``debtor_info_sha256``.

4. If the values received in the previous step (that is:
   ``debtor_info_iri``, ``debtor_info_content_type``, and
   ``debtor_info_sha256``) confirm the information obtained directly
   from the digital coin, then the digital coin has been successfully
   verified, and the user may be allowed to receive payments in the
   corresponding currency.


.. [#no-connection] When a permanent network connection is not
   configured between the user's *creditors agent* and *accounting
   authority* responsible for the given debtor, the attempt to create
   a new account will fail. Note that this scenario is not uncommon,
   and should be expected.



.. _Swaptacular: https://swaptacular.github.io/overview
.. _QR codes: https://en.wikipedia.org/wiki/QR_code
.. _Swaptacular Messaging Protocol: https://swaptacular.github.io/public/docs/protocol.pdf
.. _URI: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier
.. _HTTPS: https://en.wikipedia.org/wiki/HTTPS
.. _URL: https://en.wikipedia.org/wiki/URL
.. _redirects: https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
.. _CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
.. _machine-readable document: https://en.wikipedia.org/wiki/Machine-readable_document
.. _a peg: https://en.wikipedia.org/wiki/Fixed_exchange_rate_system
