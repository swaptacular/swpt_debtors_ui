# UI for the Swaptacular service that manages debtors

This service implements a [Simple Issuing Web
API](https://swaptacular.github.io/public/docs/swpt_debtors/redoc.html)
client. The main deliverable is a docker image, generated from the
project's [Dockerfile](../master/Dockerfile).  The generated image is
a simple static web server (using nginx), which uses the following
environment variables for configuration (along with some example
values):

```
SERVER_API_ENTRYPOINT=https://demo.swaptacular.org/debtors/.debtor
SERVER_API_TIMEOUT=8000  # milliseconds
AUTHORIZATION_URL=https://demo.swaptacular.org/debtors-hydra/oauth2/auth
TOKEN_URL=https://demo.swaptacular.org/debtors-hydra/oauth2/token
CLIENT_ID=debtors-webapp
REDIRECT_URL=https://demo.swaptacular.org/debtors-webapp/
TRANSFER_DELETION_DELAY_SECONDS=1296000
DEFAULT_PEG_ABBR=USD
DEFAULT_PEG_COIN=https://demo.swaptacular.org/debtors/4640381880/public#swpt:4640381880
```


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
the page to see your changes.

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

You can run the newly built app with `npm run start`. This uses
[sirv](https://github.com/lukeed/sirv), which is included in your
package.json's `dependencies` so that the app will work when you
deploy to platforms like [Heroku](https://heroku.com).
