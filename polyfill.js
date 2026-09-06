const { AsyncLocalStorage } = require('node:async_hooks');
if (typeof globalThis !== 'undefined' && !globalThis.AsyncLocalStorage) {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}
if (typeof global !== 'undefined' && !global.AsyncLocalStorage) {
  global.AsyncLocalStorage = AsyncLocalStorage;
}
console.log('[Polyfill] globalThis.AsyncLocalStorage initialized:', Boolean(globalThis.AsyncLocalStorage));
