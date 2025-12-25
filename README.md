# Swaptacular "Currency Issuer UI" reference implementation

This project implements a [Simple Issuing Web
API](https://swaptacular.github.io/public/docs/swpt_debtors/redoc.html)
client for [Swaptacular]. The main deliverable is a [docker image],
generated from the project's [Dockerfile](../master/Dockerfile). The
generated image is a simple static web server, running on port 80,
which serves a [Progressive Web App].

To obtain permissions to act on behalf of the user, the Web App
performs the [OAuth 2.0 Authorization Code Flow] with Proof Key for
Code Exchange (PKCE), which is specifically designed for clients that
cannot securely store a client secret, because their entire source is
available to the browser.


## Configuration

The behavior of the running container can be tuned with environment
variables. Here are the most important settings with some random
example values:

```shell
# The root path of the Web App. For example, when BASE_URL is
# "/wabapp", the Web App will be served at "/wabapp/". The default is
# "/". The value must start with a slash, and unless the value is "/",
# must not end with a slash.
BASE_URL=/wabapp

# An URL pointing to the "Redirect to the debtor's record"
# entrypoint on the server. (See the "Simple Issuing Web API"
# specification.)
SERVER_API_ENTRYPOINT=https://demo.swaptacular.org/debtors/.debtor

# OAuth 2.0 Authorization Code Flow parameters.
AUTHORIZATION_URL=https://demo.swaptacular.org/debtors-hydra/oauth2/auth
TOKEN_URL=https://demo.swaptacular.org/debtors-hydra/oauth2/token
CLIENT_ID=debtors-webapp

# This must be the starting URL for the Web App, and it must exactly
# match the "redirect URL" that has been configured for the client
# with the given CLIENT_ID.
REDIRECT_URL=https://demo.swaptacular.org/debtors-webapp/

# If the following variables are set, when the issuer wants to peg its
# currency to another currency, a default peg currency will be
# suggested. Its abbreviation will be "$DEFAULT_PEG_ABBR", and the its
# digital coin will be "$DEFAULT_PEG_COIN" (that is, the textual
# content of the digital coin's QR code).
DEFAULT_PEG_ABBR=USD
DEFAULT_PEG_COIN=https://demo.swaptacular.org/debtors/4640381880/public#swpt:4640381880
```

For more configuration options, check the
[app-config.env](../master/app-config.env) file.


## How to setup a development environment

*Note that you will need to have [Node.js](https://nodejs.org)
installed.*

Install the dependencies...

```bash
cd swpt_debtors_ui
npm install
```

...then start [Rollup](https://rollupjs.org):

```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). You should see
your app running. Edit a component file in `src`, save it, and reload
the page to see your changes. You can edit the
[config.js](../master/public/config.js) file if you want to change the
active configuration options during development.

By default, the server will only respond to requests from
localhost. To allow connections from other computers, edit the `sirv`
commands in package.json to include the option `--host 0.0.0.0`.

If you're using [Visual Studio Code](https://code.visualstudio.com/)
we recommend installing the official extension [Svelte for VS
Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode). If
you are using other editors you may need to install a plugin in order
to get syntax highlighting and intellisense.


## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can run the newly built app with `npm run start`.

**IMPORTANT NOTE: Each new version released in production, must have a
new value of the `cacheName` constant in the
[sw.js](../master/public/sw.js) file. This is necessary in order to
ensure that clients' service workers will be updated.**


[Swaptacular]: https://swaptacular.github.io/overview
[docker image]: https://www.geeksforgeeks.org/what-is-docker-images/
[Progressive Web App]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
[OAuth 2.0 Authorization Code Flow]: https://developer.okta.com/blog/2018/04/10/oauth-authorization-code-grant-type
