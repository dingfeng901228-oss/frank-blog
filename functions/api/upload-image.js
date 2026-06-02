export async function onRequest({ request, env }) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN/GH_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = formData.get('image');
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No image file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Unsupported file type: ' + file.type }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large (max 5MB)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const REPO = 'dingfeng901228-oss/frank-blog';
  const BRANCH = 'master';

  // Generate filename: images/YYYYMMDD-HHmmss-originalname
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = file.name.split('.').pop() || 'jpg';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/ /g, '_');
  const fileName = `${ts}-${safeName}`;
  const filePath = `public/images/${fileName}`;

  // Read file as base64 (safe for large files)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Check if file already exists (get SHA)
  let sha = null;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'frank-blog-uploader/1.0'
      }
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      sha = checkData.sha;
    }
  } catch (e) {
    // File doesn't exist, that's fine
  }

  // Upload to GitHub
  const payload = {
    message: `Upload image: ${fileName}`,
    content: base64,
    branch: BRANCH
  };
  if (sha) payload.sha = sha;

  const uploadRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'frank-blog-uploader/1.0'
    },
    body: JSON.stringify(payload)
  });

  if (!uploadRes.ok) {
    let errDetail = uploadRes.status + ' ' + uploadRes.statusText;
    try {
      const errData = await uploadRes.json();
      errDetail += ' — ' + (errData.message || JSON.stringify(errData));
    } catch (_) {}
    return new Response(JSON.stringify({ error: 'GitHub upload failed: ' + errDetail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const data = await uploadRes.json();

  return new Response(JSON.stringify({
    success: true,
    url: `https://blog.frank2025.com/images/${fileName}`,
    path: filePath,
    name: fileName
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export const config = { path: '/api/upload-image' };
