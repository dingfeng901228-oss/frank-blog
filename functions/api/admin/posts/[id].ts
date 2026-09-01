// functions/api/admin/posts/[id].ts
// /api/admin/posts/:id — get (GET) / update (PUT) / delete (DELETE)
// Phase 2 skeleton — Phase 5 implements

export const onRequestGet = async (context: any): Promise<Response> => {
  // TODO Phase 5: SELECT * FROM posts WHERE id = ? (return full post incl. content)
  return json(
    { error: `Not implemented — get post ${context.params.id} (Phase 5)` },
    501
  );
};

export const onRequestPut = async (context: any): Promise<Response> => {
  // TODO Phase 5:
  //   Body: same as create (full post update)
  //   UPDATE posts SET ... WHERE id = ?
  //   updated_at = datetime('now') auto
  //   Optional: write to post_revisions (Phase 5+)
  return json(
    { error: `Not implemented — update post ${context.params.id} (Phase 5)` },
    501
  );
};

export const onRequestDelete = async (context: any): Promise<Response> => {
  // TODO Phase 5:
  //   DELETE FROM posts WHERE id = ?
  //   (CASCADE deletes post_revisions + post_tags + post_categories)
  //   Returns 204 No Content
  return json(
    { error: `Not implemented — delete post ${context.params.id} (Phase 5)` },
    501
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
