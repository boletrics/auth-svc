# Boletrics Auth Service

The **Auth Service** is the authentication backend for Boletrics, built with [Hono](https://hono.dev/), [Better Auth](https://www.better-auth.com/), and [Chanfana](https://chanfana.com/) for OpenAPI 3.1 support, deployed on [Cloudflare Workers](https://workers.cloudflare.com/).

## Overview

This service handles all authentication and user management for the Boletrics platform:

- **User Authentication** - Email/password login and registration
- **Session Management** - Secure cookie-based sessions
- **Email Verification** - OTP-based email verification
- **Password Recovery** - Forgot password and reset flows
- **OAuth Providers** - Social login integration
- **Organization Support** - Multi-tenant organization plugin
- **Admin Users** - Admin role management plugin
- **JWKS** - JSON Web Key Set for JWT validation

## Tech Stack

- **Framework**: Hono (fast web framework for Cloudflare Workers)
- **Auth**: Better Auth (full-featured auth library)
- **Database**: Cloudflare D1 with Prisma adapter
- **ORM**: Prisma Client
- **OpenAPI**: Chanfana (for non-auth endpoints)
- **Validation**: Zod schemas
- **Testing**: Vitest with Cloudflare Workers pool
- **Deployment**: Cloudflare Workers via Wrangler

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Wrangler CLI (for local development)

### Installation

```bash
pnpm install
```

This will automatically run `prisma generate` via the postinstall hook.

### Local Development

```bash
# Run with local D1 database
pnpm dev:local
```

The service runs on [http://localhost:8787](http://localhost:8787).

### Database Migrations

```bash
# Apply migrations to local database
pnpm seedLocalDb:local

# Apply migrations to remote database
pnpm predeploy

# Regenerate Prisma client
pnpm prisma:generate
```

## Available Scripts

| Command                | Description                                |
| :--------------------- | :----------------------------------------- |
| `pnpm dev`             | Start dev server with remote D1            |
| `pnpm dev:local`       | Start dev server with local D1 (port 8787) |
| `pnpm deploy`          | Deploy to Cloudflare Workers               |
| `pnpm deploy:prod`     | Deploy to production environment           |
| `pnpm lint`            | Run ESLint                                 |
| `pnpm format`          | Format code with Prettier                  |
| `pnpm format:check`    | Check code formatting                      |
| `pnpm typecheck`       | Run TypeScript type checking               |
| `pnpm test`            | Run integration tests                      |
| `pnpm vitest:coverage` | Run tests with coverage report             |
| `pnpm prisma:generate` | Regenerate Prisma client                   |
| `pnpm schema`          | Extract OpenAPI schema to file             |

## Project Structure

```text
auth-svc/
├── src/
│   ├── index.ts                # Main Hono router
│   ├── auth/
│   │   ├── instance.ts         # Better Auth configuration
│   │   ├── routes.ts           # Auth route registration
│   │   └── plugins/            # Better Auth plugins
│   ├── endpoints/              # Non-auth API endpoints
│   ├── middleware/             # Request middleware (CORS, etc.)
│   ├── http/                   # HTTP utilities
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── migrations/                 # D1 database migrations
├── prisma/
│   └── schema.prisma           # Prisma schema
├── tests/
│   ├── integration/            # Integration tests
│   └── vitest.config.mts       # Vitest configuration
├── wrangler.jsonc              # Default Wrangler config
├── wrangler.local.jsonc        # Local development config
├── wrangler.preview.jsonc      # Preview environment config
└── wrangler.prod.jsonc         # Production config
```

## API Documentation

### Better Auth Endpoints

Better Auth handles all authentication routes under `/api/auth/*`:

- **OpenAPI spec**: [http://localhost:8787/api/auth/openapi.json](http://localhost:8787/api/auth/openapi.json)
- **Scalar docs**: [http://localhost:8787/docsz](http://localhost:8787/docsz)

### Custom Endpoints

Chanfana-powered endpoints:

- **Docs**: [http://localhost:8787/docs](http://localhost:8787/docs)

### Health Check

- `GET /healthz` - Returns `{ ok: true }` for health checks

## Better Auth Plugins

The service uses several Better Auth plugins:

1. **Organization** - Multi-tenant support with roles
2. **Admin** - Admin user role management
3. **OpenAPI** - Auto-generated OpenAPI specification
4. **JWT** - JSON Web Token support with a JWKS endpoint
5. **Email OTP** - OTP-based verification that replaces email links

See [BETTER_AUTH_REVIEW.md](./BETTER_AUTH_REVIEW.md) for detailed plugin documentation.

## Related Services

- **auth** - Authentication frontend (login, signup UI)
- **tickets-svc** - Ticketing service (validates JWT tokens)
- **tickets** - Customer-facing ticketing portal
- **partner** - Organization dashboard
- **admin** - Platform administration dashboard

## Security Notes

- CORS is configured via Better Auth's `trustedOrigins`
- Sessions use secure HTTP-only cookies
- JWKS endpoint available for JWT validation by other services
- See [CORS_FIX.md](./CORS_FIX.md) for CORS configuration details
