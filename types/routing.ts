// =============================
// types/routing.ts
// =============================

/**
 * Routing agent response
 */
export interface RoutingResponse {
  action: "rag" | "no_rag";
  expanded_query?: string;
  rag_optimized_query?: string;
}
