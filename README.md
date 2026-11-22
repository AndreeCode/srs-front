# SICNA — Frontend

Frontend en **Next.js 16** + React 19 + Tailwind 4.

## Seguridad (OWASP ASVS 5.0 nivel 2)

La matriz del sistema completo está en `../SICNA-backend/ASVS.md`. Del lado del front están la CSP con nonce (`proxy.ts`, `lib/csp.ts`), las cookies `__Host-` (`lib/cookie-names.ts`), `Clear-Site-Data` al salir y la reautenticación con contraseña para configurar el MFA y cerrar sesiones (`components/dashboard/account-security.tsx`). El rol nunca se toma de la cookie `session_role`. El CI genera un SBOM CycloneDX.

## Requisitos

- [bun](https://bun.sh) 1.3 o superior
- El backend corriendo (ver `../SICNA-backend/README.md`)

## 1. Configurar el `.env`

Copia el ejemplo:

```bash
cp .env.example .env
```

```env
API_BACKEND_URL=http://127.0.0.1:8000
```

## 2. Instalar y ejecutar

```bash
bun install
bun dev
```

Abre <http://localhost:3000>.

## Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123!` | Administrador |
| `coordinador` | `Coord123!` | Coordinador |
| `usuario` | `Usuario123!` | Padre |

## Comandos útiles

```bash
bun run lint         # revisar el código
bunx tsc --noEmit    # revisar los tipos
bun run build        # compilar para producción
bun start            # ejecutar el build de producción
```
