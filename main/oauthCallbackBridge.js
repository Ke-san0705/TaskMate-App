const crypto = require('crypto');
const http = require('http');

const CALLBACK_TIMEOUT_MS = 3 * 60 * 1000;
const SUPABASE_CALLBACK_PORT = 53682;

function createCallbackId() {
  return crypto.randomBytes(18).toString('base64url');
}

function createOAuthCallbackBridge({ onCallback }) {
  const callbacks = new Map();

  function closeCallback(callbackId) {
    const entry = callbacks.get(callbackId);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timeout);
    callbacks.delete(callbackId);
    entry.server.close();
  }

  function start({ provider = 'supabase' } = {}) {
    for (const existingId of callbacks.keys()) {
      closeCallback(existingId);
    }
    const callbackId = createCallbackId();
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      if (requestUrl.pathname !== '/oauth-callback') {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      const payload = {
        callbackId,
        provider,
        code: requestUrl.searchParams.get('code') || '',
        error: requestUrl.searchParams.get('error') || '',
        errorDescription: requestUrl.searchParams.get('error_description') || ''
      };

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<p>TaskMateに戻ってログインを完了します。このタブは閉じて大丈夫です。</p>');
      onCallback?.(payload);
      closeCallback(callbackId);
    });

    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(SUPABASE_CALLBACK_PORT, '127.0.0.1', () => {
        const address = server.address();
        const timeout = setTimeout(() => {
          onCallback?.({
            callbackId,
            provider,
            code: '',
            error: 'timeout',
            errorDescription: 'OAuth認証の待ち時間が過ぎました。'
          });
          closeCallback(callbackId);
        }, CALLBACK_TIMEOUT_MS);
        callbacks.set(callbackId, { server, timeout });
        resolve({
          callbackId,
          redirectUri: `http://127.0.0.1:${address.port}/oauth-callback`,
          expiresAt: Date.now() + CALLBACK_TIMEOUT_MS
        });
      });
    });
  }

  function stop() {
    for (const callbackId of callbacks.keys()) {
      closeCallback(callbackId);
    }
  }

  return {
    cancel: closeCallback,
    start,
    stop
  };
}

module.exports = { createOAuthCallbackBridge };
