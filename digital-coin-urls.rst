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

This document specifies the way "digital coins" work in Swaptacular.

In `Swaptacular`_\'s terminology, the word "debtor" means a
Swaptacular currency, with its respective issuer. "Digital coin" is a
specifically formatted URL, which uniquely identifies a debtor (a
currency) in Swaptacular, and contains a link to a document that
describes the currency.

**Note:** The key words "MUST", "MUST NOT", "REQUIRED", "SHALL",
"SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
RFC 2119.


Digital Coin
------------

The general form of a digital coin is::

  <debtor-info-locator>#<swpt-debtor-uri>

For example::
  
  https://example.com/debtor-info-locator/#swpt:6787514562

Here ``https://example.com/debtor-info-locator`` is the "Debtor Info
Locator", and ``swpt:6787514562`` uniquely identifies the debtor.


Debtor Info Locator
-------------------

"Debtor Info Locator" is an `HTTPS`_ `URL`_, which MUST either
directly return [#HTTP-OK]_ an immutable document that describes the
currency, or `redirects`_ [#redirection]_ to an immutable document
that describes the currency. 

Note that the returned document is REQUIRED to be
immutable[#immutable]_, in order to guarantee that exactly the same
document, that describes the currency, could be obtained at any future
moment, from the same URL.

When the description of the currency changes, a new document MUST be
created, containing the new description, and the "Debtor Info Locator"
MUST be updated to redirect to the newly created (the latest) version
of the document that describes the currency.


.. [#HTTP-OK] That is: Directly return an HTTP response, with response
  code ``200``, that contains an immutable document which describes
  the currency.

.. [#immutable] In this context, "immutable" means that later requests
  to the same URL, MUST return exactly the same document.

.. [#redirection] The redirection SHOULD use HTTP response code
  ``302``.


Debtor Info Document
--------------------

In Swaptacular, the document that describes the currency is called
"Debtor Info Document".

.. _Swaptacular: https://swaptacular.github.io/overview
.. _HTTPS: https://en.wikipedia.org/wiki/HTTPS
.. _URL: https://en.wikipedia.org/wiki/URL
.. _redirects: https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
