export default function Robots() {
  return new Response(
    `User-agent: *
Allow: /

Sitemap: https://blog.frank2025.com/sitemap.xml
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  )
}