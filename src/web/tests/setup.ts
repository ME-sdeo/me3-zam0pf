import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import type { jest } from '@jest/globals';

// Configure global test environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Configure test timeout
jest.setTimeout(10000);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  private callbacks = new Map<Element, ResizeObserverCallback>();

  observe(target: Element): void {
    this.callbacks.set(target, () => {});
  }

  unobserve(target: Element): void {
    this.callbacks.delete(target);
  }

  disconnect(): void {
    this.callbacks.clear();
  }
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: (key: string): string | null => {
      return store[key] || null;
    },
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => {
      return Object.keys(store)[index] || null;
    },
    get length(): number {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Configure custom test utilities and matchers
expect.extend({
  toBeValidHealthRecord(received: any) {
    const isValid = received &&
      typeof received === 'object' &&
      'id' in received &&
      'resourceType' in received;

    return {
      message: () =>
        `expected ${received} to be a valid FHIR health record`,
      pass: isValid,
    };
  },
  toHaveValidConsent(received: any) {
    const isValid = received &&
      typeof received === 'object' &&
      'consentId' in received &&
      'validFrom' in received &&
      'validTo' in received;

    return {
      message: () =>
        `expected ${received} to have valid consent information`,
      pass: isValid,
    };
  },
});

// Setup test environment cleanup
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  // Clear localStorage
  window.localStorage.clear();
  // Reset any custom test state
  document.body.innerHTML = '';
});

// Error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Promise rejection:', reason);
  process.exit(1);
});

window.onerror = (msg: any, url: any, line: any, column: any, error: any) => {
  console.error('Uncaught error:', {
    message: msg,
    url,
    line,
    column,
    error,
  });
  return false;
};

// Export custom types for TypeScript support
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidHealthRecord(): R;
      toHaveValidConsent(): R;
    }
  }
}