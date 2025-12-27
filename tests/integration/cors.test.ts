import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../src/testWorker";
import {
	getTrustedOriginPatterns,
	createCorsMiddleware,
} from "../../src/middleware/cors";
import type { Bindings } from "../../src/types/bindings";

const typedWorker = worker as unknown as {
	fetch: (
		request: Request,
		env: unknown,
		ctx: ExecutionContext,
	) => Promise<Response>;
};

const SECRET = "test-secret-123456789012345678901234567890";

const baseEnv: Bindings = {
	DB: {} as D1Database,
	ENVIRONMENT: "local",
	BETTER_AUTH_SECRET: SECRET,
} as Bindings;

describe("getTrustedOriginPatterns", () => {
	it("returns localhost origins for local environment", () => {
		const patterns = getTrustedOriginPatterns(baseEnv);
		expect(patterns).toContain("http://localhost:*");
		expect(patterns).toContain("https://localhost:*");
	});

	it("returns environment-specific origins for dev", () => {
		const patterns = getTrustedOriginPatterns({
			...baseEnv,
			ENVIRONMENT: "dev",
			BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
			AUTH_INTERNAL_TOKEN: "test-token-123456",
		});
		expect(patterns).toContain("https://*.boletrics.workers.dev");
	});

	it("includes custom trusted origins", () => {
		const patterns = getTrustedOriginPatterns({
			...baseEnv,
			ENVIRONMENT: "dev",
			BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
			AUTH_INTERNAL_TOKEN: "test-token-123456",
			AUTH_TRUSTED_ORIGINS: "https://custom.example.com,https://*.custom.com",
		});
		expect(patterns).toContain("https://custom.example.com");
		expect(patterns).toContain("https://*.custom.com");
	});

	it("caches results for same environment", () => {
		const env1 = {
			...baseEnv,
			ENVIRONMENT: "dev",
			BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
			AUTH_INTERNAL_TOKEN: "test-token-123456",
		};
		const env2 = {
			...baseEnv,
			ENVIRONMENT: "dev",
			BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
			AUTH_INTERNAL_TOKEN: "test-token-123456",
		};
		const patterns1 = getTrustedOriginPatterns(env1);
		const patterns2 = getTrustedOriginPatterns(env2);
		expect(patterns1).toBe(patterns2); // Same reference due to caching
	});
});

describe("createCorsMiddleware", () => {
	it("returns a middleware function", () => {
		const middleware = createCorsMiddleware();
		expect(typeof middleware).toBe("function");
	});
});

describe("CORS middleware integration", () => {
	it("does not apply CORS headers to auth routes (handled by Better Auth)", async () => {
		const request = new Request("http://localhost/api/auth/session", {
			method: "GET",
			headers: {
				origin: "https://app.boletrics.workers.dev",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: SECRET,
			},
			{} as ExecutionContext,
		);

		// Auth routes bypass the global CORS middleware, but Better Auth may add headers
		expect(response.status).not.toBe(403);
	});

	it("applies CORS headers to non-auth routes with trusted origin", async () => {
		const request = new Request("http://localhost/healthz", {
			method: "GET",
			headers: {
				origin: "http://localhost:3000",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "local",
				BETTER_AUTH_SECRET: SECRET,
			},
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		// localhost:* is trusted in local environment
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:3000",
		);
	});

	it("does not apply CORS headers to non-auth routes with untrusted origin", async () => {
		const request = new Request("http://localhost/healthz", {
			method: "GET",
			headers: {
				origin: "https://untrusted.com",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: SECRET,
			},
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		// Untrusted origin should not get CORS headers
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("handles requests without origin header", async () => {
		const request = new Request("http://localhost/healthz", {
			method: "GET",
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: SECRET,
			},
			{} as ExecutionContext,
		);

		expect(response.status).toBe(200);
		// No origin = no CORS headers needed
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("handles OPTIONS preflight for non-auth routes", async () => {
		const request = new Request("http://localhost/healthz", {
			method: "OPTIONS",
			headers: {
				origin: "http://localhost:3000",
				"Access-Control-Request-Method": "GET",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "local",
				BETTER_AUTH_SECRET: SECRET,
			},
			{} as ExecutionContext,
		);

		// Should return 204 for preflight
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:3000",
		);
	});
});
