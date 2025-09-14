import '@testing-library/jest-dom'

global.fetch = jest.fn()

window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  }
}

Object.defineProperty(window, 'scrollTo', { value: jest.fn(), writable: true })