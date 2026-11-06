# The web app online

StepWrite's web app can run on [Netlify](https://www.netlify.com)'s free plan, so anyone can try it
in a browser, with nothing to install. Netlify builds it from this repository each time `main`
changes. The site and its server share one address, such as `https://stepwrite.netlify.app`:

- The client is served as a static site, built from `client/`.
- The server runs as one function,
  [`server/netlify/functions/api.mjs`](../server/netlify/functions/api.mjs). It answers `/api/*`
  and `/tts/*` with the same Express app that `npm start` runs.

[`netlify.toml`](../netlify.toml) holds the build settings, so Netlify needs no other setup
besides the OpenAI key.

## Set it up

1. **Make a Netlify account.** It's free and needs no card. Signing up with GitHub is the quickest.
2. **Add the site.** Choose **Add new project > Import an existing project > GitHub**, pick
   `helalaou/StepWrite` and keep the settings Netlify reads from `netlify.toml`. The first build
   starts when you confirm.
3. **Add the OpenAI key.** Under **Project configuration > Environment variables**, add
   `OPENAI_API_KEY` with the key as its value, marked as secret and available to Functions. Netlify
   keeps it encrypted, and only the server's function can read it. It never reaches the browser.
   A key added after the first build takes effect with the next deploy: **Deploys > Trigger
   deploy**.
4. **Pick the address.** Under **Project configuration > General > Project details**, change the
   project name to `stepwrite` (or any free name) to get `https://stepwrite.netlify.app`.

After that, every push to `main` that changes `client/`, `server/`, `netlify.toml` or `.nvmrc`
deploys the site again. Pushes that change only the docs, the watch app or the phone apps, and
all other branches and pull requests, are skipped
([`ignore-build.sh`](../server/netlify/ignore-build.sh)), since each deploy uses credits.

## Keep your OpenAI spending in check

Every visitor uses your OpenAI key, so put a ceiling on it in OpenAI's dashboard:

1. Create a project for the site and set a monthly spend limit on it, enforced as a hard limit.
   Past the limit, OpenAI turns down that project's requests until the next month, and your
   other projects carry on.
2. Create the site's key in that project and use it nowhere else.
3. If your account pays with prepaid credits, keep auto recharge off. Spending then also stops at
   the credit you have added.

The site also limits what each visitor can do (`hosted` in
[`server/config.js`](../server/config.js)):

| Limit | Value |
| --- | --- |
| Writing requests (questions, drafts, the finished text) | 120 per visitor per hour |
| Speech requests (reading aloud, transcribing answers) | 400 per visitor per hour |
| Time for one request | 50 seconds. Netlify stops a function after 60. Past 25 seconds left, fact-checking stops and the text written so far is returned. |

A text usually takes 10 to 20 writing requests and 20 to 40 speech requests. A visitor over a
limit is told to try again in an hour.

The site keeps nothing about its visitors. Study mode's data saving is off, and the server logs
only warnings and errors, so what visitors write stays out of the logs.

## What the free plan covers

Netlify's free plan has 300 credits a month. When they run out, the site shows "Site not
available" until the next month, and nothing is charged.

| Use | Credits |
| --- | --- |
| A deploy | 15 |
| Writing one text, about 3 minutes of server time | about 0.5 |
| Bandwidth | 20 per GB, about 3 MB of speech per text |

So a month with four deploys leaves room for roughly 400 texts. The project's **Usage** page shows
what has been used.

## The apps and the online server

The iPhone and Android apps can use the site's server: enter its address under **Settings >
Server**. The watch app can too. It asks for each spoken question by link, and when the link
reaches a different copy of the function, the watch reads the question in its own voice instead.

## Try the online setup locally

The [Netlify CLI](https://docs.netlify.com/cli/get-started/) builds the site and runs the function
the way Netlify does:

```bash
npx netlify-cli build --offline
npx netlify-cli serve --offline
```

It serves the site at `http://localhost:8888` and needs `OPENAI_API_KEY` set in the shell. On a
Node.js 22 release older than 22.12, also set `NODE_OPTIONS=--experimental-require-module`.
