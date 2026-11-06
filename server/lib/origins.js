// Domains ngrok serves tunnels from (paid, free and legacy).
const NGROK_DOMAINS = ['ngrok.io', 'ngrok.app', 'ngrok.dev', 'ngrok-free.app', 'ngrok-free.dev'];

// Origins of the iPhone and Android apps in mobile/: Capacitor serves the
// client from capacitor://localhost on iOS and https://localhost on Android.
const APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];

// Allow the local dev client, the phone apps and HTTPS ngrok tunnels. Matching
// on the parsed hostname keeps look-alikes such as https://ngrok.evil.com out.
export function isAllowedOrigin(origin, clientPort) {
  if (APP_ORIGINS.includes(origin)) return true;

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
