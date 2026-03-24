import test from 'node:test';
import assert from 'node:assert/strict';

import { CookieXMLHttpRequest } from '../tools/cookie-xml-http-request.mjs';

test('readystatechange listeners can inspect response headers safely after request errors', () => {
  const xhr = new CookieXMLHttpRequest();
  const seenHeaders = [];

  xhr.addEventListener('readystatechange', () => {
    if (xhr.readyState >= xhr.HEADERS_RECEIVED) {
      seenHeaders.push(xhr.getResponseHeader('set-cookie'));
    }
  });

  assert.doesNotThrow(() => {
    xhr.handleError(new Error('socket polling failed'));
  });
  assert.deepEqual(seenHeaders, [null]);
});

test('getAllResponseHeaders returns an empty string when no response headers are available', () => {
  const xhr = new CookieXMLHttpRequest();
  xhr.readyState = xhr.HEADERS_RECEIVED;

  assert.equal(xhr.getAllResponseHeaders(), '');
});
