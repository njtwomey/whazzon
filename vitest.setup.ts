/**
 * A `localStorage` for jsdom tests.
 *
 * Neither `window.localStorage` nor `globalThis.localStorage` is available in
 * this environment: Node 26 ships an experimental global that stays disabled
 * unless the runtime is given a storage file, and vitest's jsdom environment
 * does not provide one either. Components reach for the bare global, which is
 * correct in a browser — so the fix belongs here rather than in every component
 * defending against a situation that cannot happen in production.
 *
 * Deliberately in-memory and per-worker: tests that care about persistence
 * clear it themselves.
 */
if (typeof window !== "undefined" && !globalThis.localStorage) {
  const store = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, value) => void store.set(String(key), String(value)),
    removeItem: (key) => void store.delete(String(key)),
    clear: () => store.clear(),
  };

  for (const target of [globalThis, window]) {
    Object.defineProperty(target, "localStorage", { value: storage, configurable: true, writable: true });
  }
}

/**
 * jsdom implements no layout, so it ships neither `ResizeObserver` nor
 * `DOMRect.fromRect` — both of which Radix's popper uses to place floating
 * content. Without them, opening a tooltip or popover throws and takes the
 * component tree down with it, which looks exactly like a broken component.
 *
 * A no-op observer is the right shim: these tests assert behaviour and
 * accessibility, not pixel positions.
 */
if (typeof window !== "undefined" && !("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    configurable: true,
    writable: true,
  });
}

if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
