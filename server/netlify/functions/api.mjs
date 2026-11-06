// The hosted site's server: StepWrite's Express app (server/app.js) inside a
// Netlify function. Netlify hands the function web Requests while Express
// expects Node's, so the app listens on a port of this machine and each
// request is passed on to it. The OpenAI key is the site's OPENAI_API_KEY
// environment variable (docs/deploy-netlify.md).
import http from 'node:http';
import '../hosted-env.mjs';
import app from '../../app.js';

const server = http.createServer(app);
const listening = new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

// Headers about one connection rather than the message. The request's host
// and length are set again for the local connection.
const CONNECTION_HEADERS = ['connection', 'keep-alive', 'transfer-encoding'];
const REQUEST_ONLY_HEADERS = ['host', 'content-length'];

export default async (request, context) => {
  await listening;
  const url = new URL(request.url);

  const headers = new Headers(request.headers);
  [...CONNECTION_HEADERS, ...REQUEST_ONLY_HEADERS].forEach(name => headers.delete(name));
  headers.set('x-forwarded-for', context.ip);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  const response = await fetch(`http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: request.body,
    duplex: 'half',
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  CONNECTION_HEADERS.forEach(name => responseHeaders.delete(name));
  return new Response(response.body, { status: response.status, headers: responseHeaders });
};

export const config = {
  path: ['/api/*', '/tts/*'],
};
