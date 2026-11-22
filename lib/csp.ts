/**
 * CSP estricta con nonce (ASVS V3.4): solo corren los scripts que Next marca con el nonce de esta
 * petición, sin 'unsafe-inline'. 'strict-dynamic' deja que esos scripts carguen sus propios chunks.
 * Los estilos conservan 'unsafe-inline' porque React usa atributos style={{...}}, que un nonce no
 * cubre; el riesgo de XSS está en los scripts. 'unsafe-eval' solo en dev (React lo usa para depurar).
 */
export function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
