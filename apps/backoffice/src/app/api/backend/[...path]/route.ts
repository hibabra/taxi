import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const API_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3000/api/v1'
).replace(/\/+$/, '');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      allow: 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    },
    status: 204,
  });
}

async function proxyApiRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = (params.path ?? []).map(encodeURIComponent).join('/');
  const incomingUrl = new URL(request.url);
  const targetUrl = `${API_BASE_URL}/${path}${incomingUrl.search}`;
  const response = await fetch(targetUrl, {
    body: await requestBody(request),
    cache: 'no-store',
    headers: proxyRequestHeaders(request.headers),
    method: request.method,
    redirect: 'manual',
  });

  return new NextResponse(response.body, {
    headers: proxyResponseHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  });
}

async function requestBody(request: Request): Promise<ArrayBuffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

function proxyRequestHeaders(source: Headers): Headers {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

function proxyResponseHeaders(source: Headers): Headers {
  const headers = new Headers(source);

  HOP_BY_HOP_HEADERS.forEach((header) => headers.delete(header));

  return headers;
}
