// functions/api/admin/_middleware.ts
// Admin API middleware — runs before any /api/admin/* route
// Phase 2 skeleton — Phase 3 validates session cookie + attaches user to context

export const onRequest = async (context: {
  request: Request;
  env: any;
}): Promise<Response | undefined> => {
  // TODO Phase 3:
  //   1. Extract session cookie from request
  //   2. SHA-256 → tokenHash
  //   3. getSessionUser(env, tokenHash)
  //   4. If null → return 401 JSON response
  //   5. If valid → attach user to context.data for downstream handlers

  // Phase 2: allow all (endpoints return 501 Not Implemented anyway)
  return undefined;
};
