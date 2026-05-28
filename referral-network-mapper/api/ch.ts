// Vercel Edge Runtime proxy for the Companies House REST API.
// Runs server-side so there are no CORS issues from the browser.
//
// Usage: GET /api/ch?chPath=/search/officers%3Fq%3DJohn%2BSmith
// Header: x-ch-key: <your-companies-house-api-key>

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'x-ch-key',
      },
    });
  }

  const url = new URL(request.url);
  const chPath = url.searchParams.get('chPath');
  const apiKey = request.headers.get('x-ch-key');

  if (!chPath) {
    return new Response(JSON.stringify({ error: 'Missing chPath query parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing x-ch-key header' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const chUrl = `https://api.company-information.service.gov.uk${chPath}`;

  try {
    const response = await fetch(chUrl, {
      headers: {
        Authorization: `Basic ${btoa(apiKey + ':')}`,
        Accept: 'application/json',
      },
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Proxy error: ${String(err)}` }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
}
