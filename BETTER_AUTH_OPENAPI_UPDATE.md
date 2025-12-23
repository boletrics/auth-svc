# Better Auth OpenAPI Plugin Integration

## Summary

Updated the project to use Better Auth's built-in OpenAPI plugin as documented at https://www.better-auth.com/docs/plugins/open-api, replacing manual OpenAPI endpoint definitions.

## Changes Made

### 1. Added Better Auth OpenAPI Plugin

**File: `src/auth/config.ts`**

- Imported `openAPI` from `better-auth/plugins`
- Added `openAPI()` plugin to the Better Auth configuration with path `/reference`
- This generates two endpoints:
  - `/api/auth/reference` - Scalar UI reference page
  - `/api/auth/open-api/generate-schema` - JSON OpenAPI schema

### 2. Updated Documentation Path

**File: `src/app-meta.ts`**

- Updated Scalar HTML to point to Better Auth's OpenAPI schema at `/api/auth/open-api/generate-schema`
- The `/docsz` endpoint now displays Better Auth endpoints using their native OpenAPI generation

### 3. Removed Manual Endpoint Definitions

**Deleted: `src/endpoints/auth/openapi.ts`**

- Removed 484 lines of manual OpenAPI endpoint definitions
- Better Auth now generates these automatically with accurate schemas

**File: `src/index.ts`**

- Removed imports for manual auth endpoint classes
- Removed manual registration of all auth endpoints (sign-up, sign-in, organization, etc.)
- Simplified codebase significantly

### 4. Updated Access Control

**File: `src/auth/routes.ts`**

- Added `/api/auth/reference` and `/api/auth/open-api/generate-schema` to public routes
- These endpoints are now accessible without authentication for documentation purposes

### 5. Updated Tests

**File: `tests/integration/docs.test.ts`**

- Updated test to verify `/docsz` points to the correct Better Auth OpenAPI endpoint
- Added new test to verify the OpenAPI schema is served at `/api/auth/open-api/generate-schema`
- Tests confirm the schema has proper OpenAPI structure with paths, info, etc.

**File: `tests/vitest.config.mts`**

- Updated coverage exclusions to remove deleted `openapi.ts` file

## Benefits

1. **Automatic Schema Generation**: Better Auth generates accurate OpenAPI schemas based on actual implementation
2. **Reduced Maintenance**: No need to manually maintain OpenAPI definitions
3. **Always Up-to-Date**: Schema automatically reflects any changes to Better Auth configuration or plugins
4. **Smaller Codebase**: Removed 484 lines of manual documentation code
5. **Better Accuracy**: Native plugin ensures schemas match actual API behavior

## Endpoints

### Better Auth OpenAPI Endpoints

- **`/api/auth/reference`** - Scalar UI displaying Better Auth API documentation
- **`/api/auth/open-api/generate-schema`** - JSON OpenAPI 3.x schema

### Application Documentation

- **`/docsz`** - Scalar UI pointing to Better Auth's generated schema
- **`/docs`** - Chanfana auto-generated documentation (for non-auth endpoints)
- **`/openapi.json`** - Chanfana OpenAPI schema (for non-auth endpoints)

## Testing

All tests pass:

- ✅ Type checking (`pnpm run typecheck`)
- ✅ Linting (`pnpm run lint`)
- ✅ Code formatting (`pnpm run format:check`)
- ✅ Integration tests (`pnpm run test`)
  - 51 tests passing including new Better Auth OpenAPI schema test

## Migration Notes

The application now follows the Better Auth OpenAPI plugin pattern as documented in the official guide. The implementation closely matches the example at https://www.better-auth.com/docs/plugins/open-api with appropriate customizations for our Cloudflare Workers environment.
