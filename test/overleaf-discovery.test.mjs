import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { __test__ } from '../tools/overleaf-discovery.mjs';

const {
  COOKIE_PLACEHOLDER,
  buildBinaryDownloadRequest,
  downloadProjectPdf,
  executeBinaryRequest,
  executeRequest,
  loadConfig,
  parseCompilePayload,
  resolveCompileOutputUrl,
  sanitizeCookieHeaderValue,
} = __test__;

async function withTempDir(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'overleaf-skill-test-'));
  try {
    return await callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeSettingsFixture(dir, source) {
  const path = join(dir, 'overleaf-agent.settings.json');
  writeFileSync(path, JSON.stringify(source, null, 2) + '\n', 'utf8');
  return path;
}

function baseConfig(overrides = {}) {
  return {
    baseUrl: 'https://www.overleaf.com',
    cookieHeader: 'session=live',
    projectId: 'project-123',
    timeoutMs: 15000,
    outputFile: join(tmpdir(), 'overleaf-skill-test.pdf'),
    ...overrides,
  };
}

test('sanitizeCookieHeaderValue treats placeholder as missing auth', () => {
  assert.equal(sanitizeCookieHeaderValue(COOKIE_PLACEHOLDER), '');
  assert.equal(sanitizeCookieHeaderValue('   '), '');
  assert.equal(sanitizeCookieHeaderValue('real=1'), 'real=1');
});

test('loadConfig ignores placeholder cookie values for status', () => {
  return withTempDir(async (dir) => {
    const configPath = writeSettingsFixture(dir, {
      $schema: './overleaf-agent.settings.schema.json',
      defaultProfile: 'personal',
      profiles: {
        personal: {
          cookieHeader: COOKIE_PLACEHOLDER,
        },
      },
    });

    const config = loadConfig('status', { config: configPath }, []);
    assert.equal(config.cookieHeader, undefined);
  });
});

test('loadConfig for connect with stdin prefers incoming cookie over stored placeholder', () => {
  return withTempDir(async (dir) => {
    const configPath = writeSettingsFixture(dir, {
      $schema: './overleaf-agent.settings.schema.json',
      defaultProfile: 'personal',
      profiles: {
        personal: {
          cookieHeader: COOKIE_PLACEHOLDER,
        },
      },
    });

    const config = loadConfig('connect', { config: configPath, cookieStdin: true }, []);
    assert.equal(config.cookieHeader, undefined);
    assert.equal(config.cookieStdin, true);
  });
});

test('parseCompilePayload supports hosted top-level compile responses', () => {
  const payload = parseCompilePayload({
    status: 'success',
    outputFiles: [
      { path: 'output.log', url: '/build/output.log', type: 'log' },
      { path: 'output.pdf', url: '/build/output.pdf', type: 'pdf', build: 'build-1' },
    ],
    outputUrlPrefix: '/zone/b',
    pdfDownloadDomain: 'https://compiles.overleafusercontent.com/zone/b',
  });

  assert.equal(payload?.status, 'success');
  assert.equal(payload?.outputFiles.length, 2);
  assert.deepEqual(payload?.pdfOutput, { path: 'output.pdf', url: '/build/output.pdf', type: 'pdf', build: 'build-1' });
  assert.equal(payload?.outputUrlPrefix, '/zone/b');
  assert.equal(payload?.pdfDownloadDomain, 'https://compiles.overleafusercontent.com/zone/b');
});

test('resolveCompileOutputUrl prefers pdfDownloadDomain for hosted compile assets', () => {
  const resolved = resolveCompileOutputUrl(
    baseConfig(),
    {
      pdfDownloadDomain: 'https://compiles.overleafusercontent.com/zone/b',
      outputUrlPrefix: '/zone/b',
    },
    {
      url: '/project/project-123/user/user-1/build/build-1/output/output.pdf',
    }
  );

  assert.equal(
    resolved,
    'https://compiles.overleafusercontent.com/zone/b/project/project-123/user/user-1/build/build-1/output/output.pdf'
  );
});

test('buildBinaryDownloadRequest keeps cookies on same-origin downloads only', () => {
  const sameOrigin = buildBinaryDownloadRequest(baseConfig(), 'https://www.overleaf.com/project/x/output.pdf');
  const crossOrigin = buildBinaryDownloadRequest(baseConfig(), 'https://compiles.overleafusercontent.com/project/x/output.pdf');

  assert.equal(sameOrigin.headers.cookie, 'session=live');
  assert.equal(crossOrigin.headers.cookie, undefined);
});

test('executeRequest omits GET bodies', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async (_url, init) => {
    seen.push(init);
    return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  try {
    await executeRequest(
      {
        method: 'GET',
        url: 'https://example.com/test',
        headers: {},
        body: 'should-not-be-sent',
      },
      { timeoutMs: 15000 }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(seen.length, 1);
  assert.equal('body' in seen[0], false);
});

test('executeBinaryRequest omits GET bodies', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async (_url, init) => {
    seen.push(init);
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  };

  try {
    await executeBinaryRequest(
      {
        method: 'GET',
        url: 'https://example.com/test.pdf',
        headers: {},
        body: 'should-not-be-sent',
      },
      { timeoutMs: 15000 }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(seen.length, 1);
  assert.equal('body' in seen[0], false);
});

test('download-pdf fails cleanly on non-PDF responses and does not write output', async () => {
  await withTempDir(async (dir) => {
    const outputFile = join(dir, 'downloaded.pdf');
    const originalFetch = globalThis.fetch;
    let calls = 0;

    globalThis.fetch = async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({
          status: 'success',
          outputFiles: [
            {
              path: 'output.pdf',
              url: '/project/project-123/user/user-1/build/build-1/output/output.pdf',
              type: 'pdf',
              build: 'build-1',
            },
          ],
          pdfDownloadDomain: 'https://compiles.overleafusercontent.com',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      assert.equal(init?.headers?.Cookie, undefined);
      return new Response('<html>not found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    };

    try {
      await assert.rejects(
        downloadProjectPdf(baseConfig({ outputFile, csrfToken: 'test-csrf' })),
        /expected a PDF response but received 404/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(existsSync(outputFile), false);
  });
});

test('download-pdf writes binary output when the resolved PDF request succeeds', async () => {
  await withTempDir(async (dir) => {
    const outputFile = join(dir, 'downloaded.pdf');
    const originalFetch = globalThis.fetch;
    let calls = 0;

    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({
          status: 'success',
          outputFiles: [
            {
              path: 'output.pdf',
              url: '/project/project-123/user/user-1/build/build-1/output/output.pdf',
              type: 'pdf',
              build: 'build-1',
            },
          ],
          pdfDownloadDomain: 'https://compiles.overleafusercontent.com',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    };

    try {
      const result = await downloadProjectPdf(baseConfig({ outputFile, csrfToken: 'test-csrf' }));
      assert.equal(result.bytesWritten, 4);
      assert.equal(result.build, 'build-1');
      assert.equal(result.outputFile, outputFile);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(existsSync(outputFile), true);
    assert.equal(readFileSync(outputFile).length, 4);
  });
});
