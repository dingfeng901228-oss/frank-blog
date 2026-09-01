// functions/api/admin/preview/[id].ts
// GET /api/admin/preview/:id — render MDX post for preview
// Phase 2 skeleton — Phase 6 implements
// Per ADR-005: same MDX renderer as production frontend (src/components/Markdown.tsx)
// Goal: MDX Source → Same Renderer → Preview / Production

export const onRequestGet = async (context: any): Promise<Response> => {
  // TODO Phase 6:
  //   1. SELECT content FROM posts WHERE id = ?
  //   2. Extract frontmatter (gray-matter { language: 'yaml' })
  //   3. Render MDX body to HTML using same react-markdown + remark-gfm + rehype-* as frontend
  //   4. Return { success: true, data: { html, frontmatter } }
  //
  // Note: Cloudflare Workers/Pages Functions can run React server-side
  //   using renderToStaticMarkup from react-dom/server.
  return json(
    { error: `Not implemented — preview post ${context.params.id} (Phase 6)` },
    501
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
