/**
 * Nombres de las cookies del navegador. En producción llevan el prefijo `__Host-` (ASVS V3.3):
 * el navegador solo las acepta con Secure, Path=/ y sin Domain, así ningún subdominio puede
 * sobrescribirlas. En desarrollo (http://localhost) van sin prefijo. Hacia el backend se
 * siguen enviando como `access_token` / `device_token`.
 */
const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";

export const SESSION_COOKIE = `${prefix}access_token`;
export const DEVICE_COOKIE = `${prefix}device_token`;
export const ROLE_COOKIE = `${prefix}session_role`;

/**
 * Al salir, el navegador borra la caché y el almacenamiento del sitio (ASVS V14): quien use
 * después el mismo equipo no ve datos de pacientes en caché. No se incluye "cookies" para
 * conservar device_token, que identifica al navegador de confianza.
 */
export const CLEAR_SITE_DATA = { "Clear-Site-Data": '"cache", "storage"' };
