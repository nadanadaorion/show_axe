export const APP_VERSION = __APP_VERSION__

export function serviceWorkerRegistrationOptions(baseUrl = document.baseURI) {
  const scopeUrl = new URL('./', baseUrl)
  const workerUrl = new URL('sw.js', scopeUrl)
  workerUrl.searchParams.set('v', APP_VERSION)
  return { scriptURL: workerUrl.href, scope: scopeUrl.pathname }
}
