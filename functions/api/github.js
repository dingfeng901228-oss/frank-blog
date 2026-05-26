export async function onRequest({ request, env }) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const apiPath = url.searchParams.get('path');
  if (!apiPath) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let githubUrl = `https://api.github.com/repos/${apiPath}`;
  const ref = url.searchParams.get('ref');
  if (ref) githubUrl += `?ref=${ref}`;

  const method = request.method;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': '***' + token,
    'User-Agent': 'frank-blog-admin'
  };

  let body = null;
  if (method === 'PUT' || method === 'DELETE') {
    const json = await request.json();
    body = JSON.stringify(json);
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(githubUrl, { method, headers, body });
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export const config = { path: '/api/github' };