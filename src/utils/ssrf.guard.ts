import { URL } from 'url';

// Plages d'IPs privées et réservées à bloquer
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,           // loopback
  /^10\./,            // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC1918
  /^192\.168\./,      // RFC1918
  /^169\.254\./,      // link-local (AWS metadata, etc.)
  /^::1$/,            // IPv6 loopback
  /^fc00:/i,          // IPv6 private
  /^fe80:/i,          // IPv6 link-local
  /^0\./,             // 0.0.0.0/8
  /^100\.64\./,       // CGNAT
];

/**
 * Vérifie qu'une URL est safe pour un appel HTTP sortant.
 * Lève une erreur si l'URL pointe vers une ressource interne (SSRF).
 */
export function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  // Seuls HTTPS et HTTP sont autorisés
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Blocked URL protocol: ${parsed.protocol}`);
  }

  // En production, forcer HTTPS uniquement
  if (process.env['NODE_ENV'] === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed in production');
  }

  const hostname = parsed.hostname;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked internal URL: ${hostname}`);
    }
  }
}
