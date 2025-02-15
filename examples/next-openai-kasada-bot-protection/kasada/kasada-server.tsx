import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { ipAddress } from '@vercel/functions';

// You can get this endpoint name from the application details on the Kasada Portal.
const kasadaAPIHostname = 'vercel-endpoint.kasadapolyform.io';
const kasadaAPIVersion = '2023-01-13-preview';
const kasadaAPIURL = `https://${kasadaAPIHostname}/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/api/${kasadaAPIVersion}/classification`;

export interface APIRequest {
  // valid IPv4 orIPv6 address of the original client making the request
  clientIp: string;
  // always provide as many of the available header from the client request
  headers: Array<{
    key: string;
    value: string;
  }>;
  method: 'HEAD' | 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  protocol: 'HTTP' | 'HTTPS';
  // /some/path
  path: string;
  // request querystring including leading '?', e.g. '?foo=bar&bar=foo'
  querystring: string;
  // always provide the (redacted) body if available in the client request
  body?: string;
}

export interface APIResponse {
  // unique request id as generated by the API
  requestId: string;
  // unique client id; only present when a client ID is available
  clientId?: string;
  // API classification
  classification: 'ALLOWED' | 'BAD-BOT' | 'GOOD-BOT' | 'HUMAN';
  // array of Set-Cookie strings, like '<cookie-name>=<cookie-value>; SameSite=None; Secure'
  responseHeadersToSet: Array<{ key: string; value: string }>;
  application: {
    mode: 'MONITOR' | 'PROTECT' | 'PASS_THROUGH';
    domain: string;
  };
  error: string;
}

/**
 * Function that fetches the Kasada classification and metadata about the request
 * and returns either this metadata or an error if something went wrong.
 */
async function getKasadaMetadata(request: NextRequest): Promise<{
  metadata?: APIResponse;
  error?: Error;
}> {
  const url = new URL(request.url);

  const headers = new Headers(request.headers);
  headers.delete('x-forwarded-host');
  headers.set('Host', 'host');

  const headersArray = [...headers.entries()].map(([key, value]) => ({
    key,
    value,
  }));

  const kasadaPayload: APIRequest = {
    clientIp: String(request.headers.get('x-real-ip') || ipAddress(request)),
    headers: headersArray,
    method: request.method as APIRequest['method'],
    protocol: url.protocol.slice(0, -1).toUpperCase() as APIRequest['protocol'],
    path: url.pathname,
    querystring: url.search,
  };

  // Set a maximum Kasada response time of 3 seconds
  const timeout = 3000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  try {
    // Send request information off to Kasada for classification
    const response = await fetch(kasadaAPIURL, {
      method: 'POST',
      headers: {
        'X-Forwarded-Host': url.hostname,
        'Content-Type': 'application/json',
        Authorization: `KasadaApiTokenV1 ${process.env.KASADA_TOKEN ?? ''}`,
      },
      signal: timeoutController.signal,
      body: JSON.stringify(kasadaPayload),
      keepalive: true,
    });
    const metadata = (await response.json()) as APIResponse;

    return {
      metadata,
    };
  } catch (error) {
    if (timeoutController.signal.aborted) {
      return {
        error: new Error('Fetch request timed out'),
      };
    }

    // Some other error occurred
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Function that continues the request to the origin
 */
async function callOrigin(): Promise<Response> {
  return NextResponse.next();
}

/**
 * Function that adds the `responseHeadersToSet` headers returned as part of the request metadata
 * to the response. These headers are necessary for the correct working of the client side SDK.
 */
function addKasadaHeaders(metadata: APIResponse, response: Response): void {
  metadata.responseHeadersToSet.forEach(({ key, value }) => {
    response.headers.set(key, value);
  });
}

/**
 * Function that adds the required CORS headers to the response on an OPTIONS request
 */
function addKasadaCORSHeaders(response: Response): void {
  const kasadaHeaders = [
    'x-kpsdk-ct',
    'x-kpsdk-cd',
    'x-kpsdk-h',
    'x-kpsdk-fc',
    'x-kpsdk-v',
    'x-kpsdk-r',
  ].join(', ');

  response.headers.append('access-control-allow-headers', kasadaHeaders);
}

export async function kasadaHandler(
  request: NextRequest,
  ev: NextFetchEvent,
): Promise<Response> {
  // If the request is an OPTIONS request we don't send it to Kasada
  // but we do add the necessary CORS headers.
  if (request.method === 'OPTIONS') {
    const response = await callOrigin();
    addKasadaCORSHeaders(response);
    return response;
  }

  // Get the classification and associated Kasada metadata about this request
  const { error, metadata } = await getKasadaMetadata(request);
  if (error || metadata === undefined || metadata.error) {
    console.error('Kasada error', error || metadata?.error);

    return callOrigin();
  }

  if (metadata.classification !== 'ALLOWED') {
    console.info('Kasada metadata bot', metadata.classification, metadata);
  } else {
    console.log('Kasada metadata', metadata.classification, metadata);
  }

  // If the request is a Bad Bot and we're in Protect mode, we'll block this request
  // and add the Kasada headers to the response for the Client-side SDKs
  if (
    metadata.classification === 'BAD-BOT' &&
    metadata.application.mode === 'PROTECT'
  ) {
    const blockResponse = new Response(undefined, {
      status: 429,
    });

    addKasadaHeaders(metadata, blockResponse);
    return blockResponse;
  }

  // No Bad Bot detected (or application is not in Protect mode)
  // let's send the request to the Origin and add Kasada headers to response
  const response = await callOrigin();
  addKasadaHeaders(metadata, response);
  return response;
}
