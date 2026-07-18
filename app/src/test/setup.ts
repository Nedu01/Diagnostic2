import '@testing-library/jest-dom/vitest'

// jsdom 29 defers storage to Node's webstorage, whose localStorage is
// unavailable unless Node runs with --localstorage-file; provide an
// in-memory stand-in so tests behave the same on any Node version.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>()
  const localStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(String(key)) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(String(key))
    },
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true })
}
