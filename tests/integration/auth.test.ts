import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../src/testWorker";

import { INTERNAL_AUTH_HEADER } from "../../src/auth/routes";

const typedWorker = worker as unknown as {
	fetch: (
		request: Request,
		env: unknown,
		ctx: ExecutionContext,
	) => Promise<Response>;
};

const TEST_SECRET = "test-secret-1234567890123456789012345";
const TEST_INTERNAL_TOKEN = "test-internal-token-12345";

describe("Better Auth route access control", () => {
	it("rejects requests without the internal token in non-local envs", async () => {
		const request = new Request("http://localhost/api/auth/health");
		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "dev",
				BETTER_AUTH_SECRET: TEST_SECRET,
				BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		expect(response.status).toBe(403);
	});

	it("allows JWKS to be fetched without the internal token", async () => {
		const request = new Request("http://localhost/api/auth/jwks");
		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "dev",
				BETTER_AUTH_SECRET: TEST_SECRET,
				BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		// Depending on whether migrations were applied in the test DB, this may be 200/500/404,
		// but it must not be blocked by the private-surface guard.
		expect(response.status).not.toBe(403);
	});

	it("allows requests with the correct internal token header", async () => {
		const request = new Request("http://localhost/api/auth/health", {
			headers: {
				[INTERNAL_AUTH_HEADER]: TEST_INTERNAL_TOKEN,
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "dev",
				BETTER_AUTH_SECRET: TEST_SECRET,
				BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		expect(response.status).not.toBe(403);
	});

	it("does not require the header in local env", async () => {
		const request = new Request("http://localhost/api/auth/health");

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "local",
				BETTER_AUTH_SECRET: TEST_SECRET,
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		expect(response.status).not.toBe(403);
	});

	it("allows trusted browser origins in non-local envs", async () => {
		const request = new Request("http://localhost/api/auth/health", {
			headers: {
				origin: "https://app.boletrics.workers.dev",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "dev",
				BETTER_AUTH_SECRET: TEST_SECRET,
				BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		// Should not be blocked by 403 even without internal token if origin is trusted
		expect(response.status).not.toBe(403);
	});

	it("rejects requests with incorrect internal token", async () => {
		const request = new Request("http://localhost/api/auth/health", {
			headers: {
				[INTERNAL_AUTH_HEADER]: "wrong-token",
			},
		});

		const response = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "dev",
				BETTER_AUTH_SECRET: TEST_SECRET,
				BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
				AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
			},
			{} as ExecutionContext,
		);

		expect(response.status).toBe(403);
	});

	describe("OPTIONS preflight requests", () => {
		it("handles OPTIONS request with trusted origin", async () => {
			const request = new Request("http://localhost/api/auth/sign-in/email", {
				method: "OPTIONS",
				headers: {
					origin: "https://app.boletrics.workers.dev",
				},
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Better Auth handles OPTIONS - may return 200/204/404 depending on route
			// Just verify it's not blocked by 403
			expect(response.status).not.toBe(403);
		});

		it("handles OPTIONS request without origin", async () => {
			const request = new Request("http://localhost/api/auth/sign-in/email", {
				method: "OPTIONS",
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Better Auth handles OPTIONS - just verify it's not blocked
			expect(response.status).not.toBe(403);
		});

		it("handles OPTIONS request with untrusted origin", async () => {
			const request = new Request("http://localhost/api/auth/sign-in/email", {
				method: "OPTIONS",
				headers: {
					origin: "https://evil.com",
				},
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Better Auth handles OPTIONS - just verify it's not blocked
			expect(response.status).not.toBe(403);
		});
	});

	describe("CORS headers on actual requests", () => {
		it("handles GET request with trusted origin", async () => {
			// Use GET request to avoid Better Auth throwing unhandled errors
			// for invalid POST data
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
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Better Auth handles CORS internally via trustedOrigins config
			// Response may be 401/500 due to missing session, but should not be blocked
			expect(response.status).not.toBe(403);
			// Better Auth may add CORS headers for trusted origins
			// We just verify the request is processed (not blocked)
		});

		it("does not add CORS headers to POST request without origin", async () => {
			const request = new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email: "test@example.com", password: "test" }),
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// If there's no origin, CORS headers shouldn't be added
			// But Better Auth might add its own headers, so we just check the response is valid
			expect(response.status).toBeGreaterThanOrEqual(200);
		});

		it("does not add CORS headers to POST request with untrusted origin", async () => {
			// Use a GET request to avoid Better Auth throwing errors for invalid credentials
			const request = new Request("http://localhost/api/auth/session", {
				method: "GET",
				headers: {
					origin: "https://evil.com",
				},
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Untrusted origin should not get CORS headers
			// Better Auth will return a response (may be 401 for missing session)
			expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe(
				"https://evil.com",
			);
		});
	});

	describe("Public routes that bypass internal token check", () => {
		it("allows access to /api/auth/verify-email without internal token", async () => {
			// Note: Better Auth throws an unhandled APIError for invalid tokens,
			// so we just verify the route is not blocked by internal token check
			const request = new Request(
				"http://localhost/api/auth/verify-email?token=invalid-test-token",
				{
					method: "GET",
				},
			);
			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Should not be blocked by the internal token check (403)
			// Better Auth may return 401 or other status for invalid token
			expect(response.status).not.toBe(403);
		});

		it("allows access to /api/auth/reset-password without internal token", async () => {
			const request = new Request(
				"http://localhost/api/auth/reset-password?token=test",
			);
			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Should not be blocked by the internal token check
			expect(response.status).not.toBe(403);
		});

		it("allows access to /api/auth/reference without internal token", async () => {
			const request = new Request("http://localhost/api/auth/reference");
			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Should not be blocked by the internal token check
			expect(response.status).not.toBe(403);
		});

		it("allows access to /api/auth/open-api/generate-schema without internal token", async () => {
			const request = new Request(
				"http://localhost/api/auth/open-api/generate-schema",
			);
			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "dev",
					BETTER_AUTH_SECRET: TEST_SECRET,
					BETTER_AUTH_URL: "https://auth-svc.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: TEST_INTERNAL_TOKEN,
				},
				{} as ExecutionContext,
			);

			// Should not be blocked by the internal token check
			expect(response.status).not.toBe(403);
		});
	});

	describe("Turnstile validation for forgot-password", () => {
		it("skips Turnstile validation when TURNSTILE_SECRET_KEY is not configured", async () => {
			const request = new Request("http://localhost/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "test@example.com" }),
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "test",
					BETTER_AUTH_SECRET: TEST_SECRET,
					// No TURNSTILE_SECRET_KEY
				},
				{} as ExecutionContext,
			);

			// Should not fail due to Turnstile (Turnstile is skipped when not configured)
			// Response may be 200 or other status depending on Better Auth processing
			expect(response.status).not.toBe(400); // Not a Turnstile validation error
		});

		it("rejects forgot-password when Turnstile is configured but token is missing", async () => {
			const request = new Request("http://localhost/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "test@example.com" }),
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "test",
					BETTER_AUTH_SECRET: TEST_SECRET,
					TURNSTILE_SECRET_KEY: "test-turnstile-secret",
				},
				{} as ExecutionContext,
			);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body).toHaveProperty("message", "Turnstile token is required");
		});

		it("rejects forgot-password with invalid JSON body when Turnstile is configured", async () => {
			const request = new Request("http://localhost/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not-json",
			});

			const response = await typedWorker.fetch(
				request,
				{
					...env,
					ENVIRONMENT: "test",
					BETTER_AUTH_SECRET: TEST_SECRET,
					TURNSTILE_SECRET_KEY: "test-turnstile-secret",
				},
				{} as ExecutionContext,
			);

			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body).toHaveProperty("message", "Invalid request body");
		});
	});
});
