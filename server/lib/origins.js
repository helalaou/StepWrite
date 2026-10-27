// Domains ngrok serves tunnels from (paid, free and legacy).
const NGROK_DOMAINS = ['ngrok.io', 'ngrok.app', 'ngrok.dev', 'ngrok-free.app', 'ngrok-free.dev'];

// Allow the local dev client and HTTPS ngrok tunnels. Matching on the parsed
// hostname keeps look-alikes such as https://ngrok.evil.com out.
export function isAllowedOrigin(origin, clientPort) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  const isLocalClient = url.protocol === 'http:'
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    && url.port === String(clientPort);
  if (isLocalClient) return true;

  return url.protocol === 'https:'
    && NGROK_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}
