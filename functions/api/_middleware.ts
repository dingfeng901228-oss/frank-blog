// functions/api/_middleware.ts
// Top-level API middleware — runs before any /api/* route
// Phase 2 skeleton — Phase 3+ can add rate limiting / logging aggregation

export const onRequest = async (context: {
  request: Request;
  env: any;
}): Promise<Response | undefined> => {
  const url = new URL(context.request.url);
  console.log(`[api] ${context.request.method} ${url.pathname}`);
  // Returning undefined = continue to next handler (matched route)
  return undefined;
};
