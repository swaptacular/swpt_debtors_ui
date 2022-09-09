++++++++++++++++++++++++++++
Digital Coins in Swaptacular
++++++++++++++++++++++++++++
:Description: Specifies the way digital coins work in Swaptacular
:Author: Evgeni Pandurksi
:Contact: epandurski@gmail.com
:Date: 2022-09-10
:Version: 1.0
:Copyright: This document has been placed in the public domain.


Overview
========

This document specifies the way *digital coins* work in Swaptacular.

In `Swaptacular`_\'s terminology, the word "debtor" means a
Swaptacular currency, with its respective issuer. A "digital coin" is
a specially formatted URL, which uniquely identifies a debtor (a
currency) in Swaptacular, and contains a link to a document that
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
  scheme[#swpt-scheme]_, which uniquely identifies the debtor.

Example: ``https://example.com/foo/bar#swpt:6787514562``

Here the `URL`_ ``https://example.com/foo/bar`` is the `Debtor Info
Locator`_, and ``swpt:6787514562`` is the URI that uniquely identifies
the debtor.
  

.. [#swpt-scheme] The ``swpt`` URI scheme is defined in a separate
  document.

   

Debtor Info Locator
-------------------

"Debtor Info Locator" is an `HTTPS`_ URL, making a network request to
which, MUST either directly return[#HTTP-OK]_ an *immutable document*
that describes the currency, or `redirects`_[#redirection]_ to a
different URL, from which an *immutable document* that describes the
currency can be retrieved. The retrieved document is REQUIRED to be
immutable[#immutable]_.

**Important note:** When the description of the currency changes, a
new document (with a new URL) MUST be created, containing the new
description, and the "Debtor Info Locator" MUST be updated to redirect
to the newly created (the latest) version of the currency description
document.


.. [#HTTP-OK] That is: Directly return an HTTP response, with response
  code ``200``, that contains an immutable document which describes
  the currency.

.. [#immutable] In this context, "immutable" means that later requests
  to the same URL, MUST return exactly the same document.

.. [#redirection] The redirection SHOULD use HTTP response code
  ``302``.


Debtor Info Documents
---------------------

In Swaptacular, a document that describes a currency is called a
"Debtor Info Document". Different standard formats can be used for
debtor info documents, which will not be discussed here.


Validation of Digital Coins
---------------------------

Debtor info documents MUST be transferred via cryptographically
secured connections. Although HTTPS (which is used for Debtor Info
Locators) gives some level of security, the information contained in a
debtor info document is so critical, that its authenticity SHOULD be
independently verified before the user is allowed to receive payments
in the corresponding currency. Here is how the independent
verification SHOULD be done:

1. If an acccount with the debtor specified by ``<swpt-debtor-uri>``
   does not exist already, a request should be made via the
   `Swaptacular Messaging Protocol`_, to create new account with the
   debtor.

2. If a new account with the debtor can not be created, the
   verification has failed.

3. If an account with the debtor already exists, or has been
   successfully be created ...


.. _Swaptacular: https://swaptacular.github.io/overview
.. _Swaptacular Messaging Protocol: https://swaptacular.org/public/docs/protocol.pdf
.. _URI: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier
.. _HTTPS: https://en.wikipedia.org/wiki/HTTPS
.. _URL: https://en.wikipedia.org/wiki/URL
.. _redirects: https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
.. _TLS: https://en.wikipedia.org/wiki/Transport_Layer_Security
