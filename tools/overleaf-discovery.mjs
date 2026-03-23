#!/usr/bin/env node

const SECRET_KEYS = new Set(['cookie', 'cookieheader', 'csrf', 'csrftoken', 'authorization', 'auth', 'set-cookie', 'x-csrf-token']);
const DEFAULT_TIMEOUT_MS = 15000;

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

async function main() {
  const { command, options, extraArgs } = parseArgs(process.argv.slice(2));
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(command, options, extraArgs);
  const result = await runCommand(command, config);

  if (config.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  printResult(command, result);
}

function loadConfig(command, options, extraArgs) {
  const env = process.env;
  const baseUrl = options.baseUrl || env.OVERLEAF_BASE_URL;
  const cookieHeader = options.cookie || env.OVERLEAF_COOKIE_HEADER;
  const csrfToken = options.csrf || env.OVERLEAF_CSRF_TOKEN;
  const projectId = options.projectId || env.OVERLEAF_PROJECT_ID;
  const fileId = options.fileId || options.docId || env.OVERLEAF_FILE_ID || env.OVERLEAF_DOC_ID;
  const filePath = options.filePath || env.OVERLEAF_FILE_PATH;
  const timeoutMs = numberFrom(options.timeoutMs || env.OVERLEAF_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const json = toBoolean(options.json || env.OVERLEAF_JSON);
  const dryRun = toBoolean(options.dryRun || env.OVERLEAF_DRY_RUN || command.startsWith('probe-'));
  const sendMutations = toBoolean(options.send || env.OVERLEAF_SEND_MUTATIONS);
  const endpoint =
    options.endpoint ||
    env[`OVERLEAF_${commandToEnvKey(command)}_ENDPOINT`] ||
    env[commandSpecificEndpointKey(command)] ||
    env.OVERLEAF_ENDPOINT;
  const method = (options.method || env[`OVERLEAF_${commandToEnvKey(command)}_METHOD`] || inferMethod(command)).toUpperCase();
  const headers = parseHeaders(options.header, env.OVERLEAF_EXTRA_HEADERS);
  const body = options.body || env.OVERLEAF_BODY || '';
  const rawArgs = extraArgs;

  return {
    command,
    baseUrl,
    cookieHeader,
    csrfToken,
    projectId,
    fileId,
    filePath,
    timeoutMs,
    json,
    dryRun,
    sendMutations,
    endpoint,
    method,
    headers,
    body,
    rawArgs,
    verbose: toBoolean(options.verbose || env.OVERLEAF_VERBOSE),
  };
}

async function runCommand(command, config) {
  switch (command) {
    case 'validate':
      return requestCommand('validate', config, {
        defaultEndpoint: '/user/projects',
        required: ['baseUrl', 'cookieHeader'],
      });
    case 'projects':
      return requestCommand('projects', config, {
        defaultEndpoint: '/user/projects',
        required: ['baseUrl', 'cookieHeader'],
      });
    case 'tree':
      return requestCommand('tree', config, {
        defaultEndpoint: '/project/${projectId}/entities',
        required: ['baseUrl', 'cookieHeader', 'projectId'],
      });
    case 'read':
      return requestCommand('read', config, {
        defaultEndpoint: '/Project/${projectId}/doc/${fileId}/download',
        required: ['baseUrl', 'cookieHeader', 'projectId', 'fileId'],
      });
    case 'extract-csrf':
      return extractCsrf(config);
    case 'probe-write':
      return probeWrite(config);
    case 'probe-refresh':
      return probeRefresh(config);
    case 'contract':
      return buildContractSummary(config);
    case 'request':
      return requestCommand('request', config, {
        defaultEndpoint: '',
        required: ['baseUrl', 'cookieHeader'],
      });
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function requestCommand(label, config, { defaultEndpoint, required }) {
  assertRequired(config, required, label);

  const endpoint = config.endpoint || defaultEndpoint;
  if (!endpoint) {
    throw new Error(`Missing endpoint for ${label}. Set OVERLEAF_${commandToEnvKey(label)}_ENDPOINT or pass --endpoint.`);
  }

  const request = buildRequest(config, endpoint, config.method);
  if (config.dryRun) {
    return { mode: 'dry-run', request: redactAny(request, config) };
  }

  const response = await executeRequest(request, config);
  return summarizeResponse(label, request, response, config, endpoint);
}

async function extractCsrf(config) {
  assertRequired(config, ['baseUrl', 'cookieHeader'], 'extract-csrf');

  const endpoint = config.endpoint || (config.projectId ? '/Project/${projectId}' : '/project');
  const request = buildRequest(config, endpoint, 'GET', {
    accept: 'text/html,application/xhtml+xml',
  });

  if (config.dryRun) {
    return {
      mode: 'dry-run',
      request: redactAny(request, config),
      notes: [
        'Fetches an authenticated HTML page and extracts the ol-csrfToken meta tag.',
        'Use --project-id to prefer the editor page; otherwise it falls back to the project dashboard.',
      ],
    };
  }

  const response = await executeRequest(request, config);
  const extractedToken = extractMetaContent(response.body, 'ol-csrfToken');
  return {
    label: 'extract-csrf',
    endpointType: endpoint,
    found: Boolean(extractedToken),
    csrfToken: extractedToken ? '<redacted:csrfToken>' : '',
    ...summarizeResponse(
      'extract-csrf',
      request,
      response,
      extractedToken ? { ...config, csrfToken: extractedToken } : config,
      endpoint
    ),
  };
}

async function probeWrite(config) {
  assertRequired(config, ['baseUrl', 'cookieHeader'], 'probe-write');

  const endpoint = config.endpoint || process.env.OVERLEAF_WRITE_ENDPOINT || '';
  const request = buildRequest(
    config,
    endpoint || '/socket-io-write-path-unconfirmed',
    config.method === 'GET' ? 'POST' : config.method,
    {
      body: config.body || JSON.stringify({
        projectId: config.projectId || '<project-id>',
        docId: config.fileId || '<doc-id>',
        update: {
          v: '<current-version>',
          op: ['<sharejs-or-history-ot-op>'],
          meta: {
            note: 'source-verified write path is socket.io applyOtUpdate after joinDoc',
          },
        },
      }, null, 2),
      contentType: 'application/json',
    },
  );

  const canSend = Boolean(endpoint && config.sendMutations);
  if (!canSend) {
    return {
      mode: 'dry-run',
      reason: 'source review indicates writes flow through the realtime socket applyOtUpdate path; no public HTTP write endpoint is confirmed yet',
      notes: [
        'The realtime service auto-joins a project from the socket.io handshake using the projectId query parameter and the signed session cookie.',
        'Document edits are then sent as applyOtUpdate socket events after joinDoc succeeds.',
        'Keep this command in dry-run mode until a live cookie-backed probe confirms the hosted-instance behavior you want to support.',
      ],
      request: redactAny(request, config),
    };
  }

  const response = await executeRequest(request, config);
  return summarizeResponse('probe-write', request, response, config, endpoint);
}

async function probeRefresh(config) {
  assertRequired(config, ['baseUrl', 'cookieHeader'], 'probe-refresh');

  const endpoint = config.endpoint || process.env.OVERLEAF_REFRESH_ENDPOINT || '';
  const requestConfig = endpoint
    ? config
    : {
        ...config,
        projectId: config.projectId || 'project-id',
        fileId: config.fileId || 'doc-id',
      };
  const request = buildRequest(requestConfig, endpoint || '/Project/${projectId}/doc/${fileId}/download', 'GET');
  if (!endpoint) {
    return {
      mode: 'dry-run',
      reason: 'public HTTP refresh can poll the doc download route, but authoritative version metadata currently comes from joinDoc and joinProject on the realtime service',
      notes: [
        'HTTP polling looks viable for coarse text refresh by re-downloading the doc body.',
        'Source review did not find a public HTTP route that exposes the same version metadata returned by realtime joinDoc.',
        'Treat polling-only refresh as provisional until a live probe confirms acceptable behavior and conflict detection.',
      ],
      request: redactAny(request, config),
    };
  }

  if (config.dryRun) {
    return { mode: 'dry-run', request: redactAny(request, config) };
  }

  const response = await executeRequest(request, config);
  return summarizeResponse('probe-refresh', request, response, config, endpoint);
}

function buildContractSummary(config) {
  return {
    label: 'contract',
    status: 'source-verified; live cookie-backed validation still required',
    mvpGate: 'closed until a safe live write probe and the refresh-path decision are complete',
    verifiedFromSource: {
      sessionCookie: 'default CE/web cookie name is overleaf.sid; hosted or legacy deployments may expose a different session cookie in the browser',
      validation: 'GET /user/projects',
      projectList: ['GET /user/projects', 'POST /api/project (csrf-protected)'],
      fileTree: [
        'GET /project/:Project_id/entities (public web route; paths/types only)',
        'socket.io auto-join with ?projectId=... returns the full rootFolder snapshot with ids',
      ],
      textRead: 'GET /Project/:Project_id/doc/:Doc_id/download',
      textWrite: 'socket.io applyOtUpdate after joinDoc; no public HTTP write route confirmed',
      csrf: 'webRouter uses csurf; frontend sends X-Csrf-Token from the ol-csrfToken meta tag',
      refresh: 'joinDoc returns doc version and ops; the public doc download route does not expose equivalent version metadata',
    },
    remainingLiveChecks: [
      'Confirm the target hosted instance accepts the same validation and read routes with a real imported session cookie.',
      'Confirm how the hosted instance exposes the full project tree in a way the extension can reproduce safely.',
      'Confirm one safe write against a throwaway project or file.',
      'Decide whether MVP refresh can stay HTTP-polling-only or must use the realtime socket path.',
    ],
    notes: [
      'Use extract-csrf to fetch an authenticated HTML page and recover the current CSRF token.',
      'Use request for one-off probes once a hosted-instance-specific route needs to be tested.',
      'Treat this summary as source-verified, not live-instance-validated, until you run the commands with a real session cookie.',
    ],
  };
}

function buildRequest(config, endpoint, method, extra = {}) {
  const url = new URL(applyTemplate(endpoint, config), config.baseUrl);
  const headers = new Headers({
    Accept: extra.accept || 'application/json, text/plain, */*',
    Cookie: config.cookieHeader,
    ...config.headers,
    ...(extra.contentType ? { 'Content-Type': extra.contentType } : {}),
  });

  if (config.csrfToken) {
    headers.set('X-CSRF-Token', config.csrfToken);
  }

  const body = extra.body || config.body || undefined;
  if (body && method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  return {
    method,
    url: url.toString(),
    headers: Object.fromEntries(headers.entries()),
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  };
}

async function executeRequest(request, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${config.timeoutMs}ms`)), config.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeResponse(label, request, response, config, endpointType = '') {
  const bodyPreview = previewBody(response.body, 1600);
  const redacted = redactAny({
    request,
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      bodyPreview,
    },
  }, config);

  const result = { label, endpointType, ...redacted };
  if (label === 'tree' && response.ok) {
    result.notes = [
      'The /project/:Project_id/entities route is useful for path/type inventory, but it does not expose the rootFolder ids required for editor-style joins.',
      'Use the realtime socket join for a full project snapshot once you are ready to validate socket auth with a live session cookie.',
    ];
  }
  if (label === 'read' && response.ok) {
    result.notes = [
      'This route downloads doc text over plain HTTP and is the simplest public read probe found in the upstream source.',
      'It does not expose the realtime version metadata returned by joinDoc.',
    ];
  }
  return result;
}

function printResult(command, result) {
  console.log(`# ${command}`);
  if (result.mode === 'dry-run') {
    console.log('Mode: dry-run');
  }
  if (result.reason) {
    console.log(`Reason: ${result.reason}`);
  }

  if (Array.isArray(result.notes) && result.notes.length > 0) {
    console.log('');
    console.log('Notes:');
    for (const note of result.notes) {
      console.log(`  - ${note}`);
    }
  }

  if (typeof result.found === 'boolean') {
    console.log('');
    console.log(`CSRF token found: ${result.found ? 'yes' : 'no'}`);
  }
  if (result.csrfToken) {
    console.log(`CSRF token: ${result.csrfToken}`);
  }

  if (result.request) {
    console.log('');
    console.log('Request:');
    console.log(`  ${result.request.method} ${result.request.url}`);
    printObject(result.request.headers, '  ');
    if (result.request.body) {
      console.log('  body:');
      printMultiline(result.request.body, '    ');
    }
  }

  if (result.response) {
    console.log('');
    console.log('Response:');
    console.log(`  ${result.response.status} ${result.response.statusText}`);
    printObject(result.response.headers, '  ');
    console.log('  body preview:');
    printMultiline(result.response.bodyPreview || '', '    ');
  }

  printExtraFields(result);
}

function printObject(value, indent) {
  for (const [key, raw] of Object.entries(value || {})) {
    console.log(`${indent}${key}: ${formatScalar(raw)}`);
  }
}

function printMultiline(value, indent) {
  const lines = String(value).split('\n');
  for (const line of lines) {
    console.log(`${indent}${line}`);
  }
}

function formatScalar(value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function previewBody(body, limit) {
  if (!body) return '';
  const text = body.trim();
  if (!text) return '';
  if (isJsonLike(text)) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2).slice(0, limit);
    } catch {
      return text.slice(0, limit);
    }
  }
  return text.slice(0, limit);
}

function isJsonLike(text) {
  const first = text[0];
  return first === '{' || first === '[';
}

function redactAny(value, config) {
  const replacements = new Map();
  for (const key of ['cookieHeader', 'csrfToken']) {
    const raw = config?.[key];
    if (raw) replacements.set(raw, `<redacted:${key}>`);
  }

  return redactStructured(value, replacements);
}

function redactStructured(value, replacements) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let result = value;
    for (const [needle, replacement] of replacements.entries()) {
      if (needle) result = result.split(needle).join(replacement);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactStructured(entry, replacements));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        output[key] = '<redacted>';
        continue;
      }
      output[key] = redactStructured(entry, replacements);
    }
    return output;
  }
  return value;
}

function parseArgs(argv) {
  const options = {};
  const extraArgs = [];
  let command = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg.startsWith('--')) {
      const [flag, inlineValue] = arg.split('=', 2);
      const key = flag.slice(2);
      switch (key) {
        case 'base-url': options.baseUrl = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'cookie': options.cookie = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'csrf': options.csrf = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'project-id': options.projectId = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'file-id': options.fileId = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'doc-id': options.docId = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'file-path': options.filePath = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'endpoint': options.endpoint = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'method': options.method = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'timeout-ms': options.timeoutMs = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        case 'json': options.json = true; break;
        case 'verbose': options.verbose = true; break;
        case 'dry-run': options.dryRun = true; break;
        case 'send': options.send = true; break;
        case 'header': {
          options.header ??= [];
          options.header.push(readArgValue(argv, i, inlineValue, key));
          if (inlineValue === undefined) i += 1;
          break;
        }
        case 'body': options.body = readArgValue(argv, i, inlineValue, key); if (inlineValue === undefined) i += 1; break;
        default:
          extraArgs.push(arg);
      }
      continue;
    }

    extraArgs.push(arg);
  }

  return { command, options, extraArgs };
}

function parseHeaders(headerValues, extraHeaderValues) {
  const headers = {};
  const values = [];
  if (Array.isArray(headerValues)) values.push(...headerValues);
  if (typeof extraHeaderValues === 'string' && extraHeaderValues.trim()) values.push(...extraHeaderValues.split(/\r?\n+/));
  for (const value of values) {
    const index = value.indexOf('=');
    const colon = value.indexOf(':');
    const splitAt = index > -1 && (colon === -1 || index < colon) ? index : colon;
    if (splitAt === -1) continue;
    const key = value.slice(0, splitAt).trim();
    const headerValue = value.slice(splitAt + 1).trim();
    if (key) headers[key] = headerValue;
  }
  return headers;
}

function assertRequired(config, required, label) {
  const missing = [];
  for (const key of required) {
    if (!config[key]) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`${label}: missing required config: ${missing.join(', ')}`);
  }
}

function inferMethod(command) {
  switch (command) {
    case 'probe-write':
      return 'POST';
    default:
      return 'GET';
  }
}

function applyTemplate(template, config) {
  return template
    .replaceAll('${projectId}', encodeURIComponent(config.projectId || ''))
    .replaceAll('${fileId}', encodeURIComponent(config.fileId || ''))
    .replaceAll('${filePath}', encodePath(config.filePath || ''))
    .replaceAll('${baseUrl}', config.baseUrl || '');
}

function commandToEnvKey(command) {
  return command.replace(/-/g, '_').toUpperCase();
}

function commandSpecificEndpointKey(command) {
  switch (command) {
    case 'probe-write':
      return 'OVERLEAF_WRITE_ENDPOINT';
    case 'probe-refresh':
      return 'OVERLEAF_REFRESH_ENDPOINT';
    default:
      return '';
  }
}

function numberFrom(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return false;
}

function readArgValue(argv, index, inlineValue, key) {
  if (inlineValue !== undefined) {
    return inlineValue;
  }

  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for --${key}`);
  }

  return value;
}

function encodePath(value) {
  return String(value)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase();
  return SECRET_KEYS.has(normalized) || normalized.includes('cookie') || normalized.includes('csrf') || normalized === 'authorization';
}

function extractMetaContent(html, name) {
  if (!html) return '';
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta[^>]*name=["']${escapedName}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(pattern);
  return match?.[1] || '';
}

function printExtraFields(result) {
  const handledKeys = new Set(['label', 'mode', 'reason', 'notes', 'found', 'csrfToken', 'request', 'response', 'endpointType']);
  for (const [key, value] of Object.entries(result)) {
    if (handledKeys.has(key) || value === undefined || value === null || value === '') {
      continue;
    }

    console.log('');
    console.log(`${formatSectionLabel(key)}:`);
    if (Array.isArray(value)) {
      for (const entry of value) {
        console.log(`  - ${formatScalar(entry)}`);
      }
      continue;
    }
    if (typeof value === 'object') {
      printObject(value, '  ');
      continue;
    }
    console.log(`  ${formatScalar(value)}`);
  }
}

function formatSectionLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (match) => match.toUpperCase());
}

function printUsage() {
  console.log(`Usage:
  node tools/overleaf-discovery.mjs <command> [options]

Commands:
  validate        Validate an authenticated session using a lightweight request
  projects        Fetch the project list
  tree            Fetch the public path/type project inventory for a project
  read            Download a single text document from a project
  extract-csrf    Fetch an authenticated HTML page and extract ol-csrfToken
  probe-write     Summarize the verified write path and prepare a safe probe
  probe-refresh   Summarize the verified refresh path and prepare a safe probe
  contract        Print the source-verified request contract summary
  request         Send an arbitrary request using the configured endpoint

Options:
  --base-url <url>      Overleaf base URL, e.g. https://www.overleaf.com
  --cookie <header>     Raw Cookie header value
  --csrf <token>        CSRF token if required
  --project-id <id>     Project id for tree/read probes
  --file-id <id>        Document id for read probes
  --doc-id <id>         Alias for --file-id
  --file-path <path>    File path for read/write probes
  --endpoint <path>     Override the endpoint template
  --method <verb>       Override the HTTP verb
  --header k=v          Add an extra header; repeatable
  --body <text>         Override the request body
  --timeout-ms <n>      Timeout in milliseconds
  --dry-run             Print the request without sending it
  --send                Allow mutation probes to send requests
  --json                Emit machine-readable JSON
  --verbose             Include extra diagnostic detail

Environment:
  OVERLEAF_BASE_URL
  OVERLEAF_COOKIE_HEADER
  OVERLEAF_CSRF_TOKEN
  OVERLEAF_PROJECT_ID
  OVERLEAF_FILE_ID
  OVERLEAF_DOC_ID
  OVERLEAF_FILE_PATH
  OVERLEAF_ENDPOINT
  OVERLEAF_VALIDATE_ENDPOINT
  OVERLEAF_PROJECTS_ENDPOINT
  OVERLEAF_TREE_ENDPOINT
  OVERLEAF_READ_ENDPOINT
  OVERLEAF_WRITE_ENDPOINT
  OVERLEAF_REFRESH_ENDPOINT
  OVERLEAF_DRY_RUN=1
  OVERLEAF_SEND_MUTATIONS=1
  OVERLEAF_JSON=1
`);
}
