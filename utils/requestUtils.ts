/**
 * Utility functions for handling request information
 */

import { NextRequest } from "next/server";

/**
 * Get client IP address from request
 * Handles various proxy headers including nginx configurations
 */
export function getClientIP(request: NextRequest): string {
  // Try to get IP from different headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = forwarded.split(",");
    return ips[0].trim();
  }

  // For nginx reverse proxy, use x-real-ip
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Default fallback
  return "unknown";
}

/**
 * Create a simple hash from a string
 */
export function createSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36); // Convert to base36 string
}

/**
 * Generate a client connection fingerprint based on IP and user agent
 */
export function getClientConnectionFingerprint(ipAddress: string, userAgent: string | null | undefined): string {
  const ipHash = createSimpleHash(ipAddress || 'unknown');
  const uaHash = createSimpleHash(userAgent || 'unknown');
  return `${ipHash}_${uaHash}`;
}