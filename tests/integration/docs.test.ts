import { env, SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { getOpenApiInfo } from "../../src/app-meta";
import worker from "../../src/testWorker";

const typedWorker = worker as unknown as {
	fetch: (
		request: Request,
		env: unknown,
		ctx: ExecutionContext,
	) => Promise<Response>;
};

const TEST_SECRET = "test-secret-1234567890123456789012345";

describe("API docs", () => {
	it("serves Scalar API reference at /docsz with Better Auth OpenAPI spec", async () => {
		const res = await SELF.fetch("http://local.test/docsz");
		const html = await res.text();

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") ?? "").toMatch(/text\/html/i);
		// High-signal markers that we are serving Scalar (not the old viewer).
		expect(html).toContain("@scalar/api-reference");
		expect(html).toContain("api-reference");
		// Verify it points to Better Auth's OpenAPI spec
		expect(html).toContain("/api/auth/open-api/generate-schema");
	});

	it("serves app metadata JSON at /", async () => {
		const res = await SELF.fetch("http://local.test/");
		const body = (await res.json()) as { name?: string; version?: string };

		expect(res.status).toBe(200);
		expect(body).toHaveProperty("name");
		expect(body).toHaveProperty("version");
	});

	it("serves health check at /healthz", async () => {
		const res = await SELF.fetch("http://local.test/healthz");
		const body = (await res.json()) as { ok?: boolean };

		expect(res.status).toBe(200);
		expect(body.ok).toBe(true);
	});

	it("returns a 500 JSON for unexpected errors", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const res = await SELF.fetch("http://local.test/", {
			headers: {
				"x-force-error": "1",
			},
		});
		const body = await res.json<{
			success: boolean;
			errors: Array<{ code: number; message: string }>;
		}>();

		expect(res.status).toBe(500);
		expect(body.success).toBe(false);
		expect(body.errors[0]).toEqual({
			code: 7000,
			message: "Internal Server Error",
		});

		consoleErrorSpy.mockRestore();
	});

	it("serves OpenAPI schema JSON", async () => {
		const res = await SELF.fetch("http://local.test/openapi.json");
		const body = (await res.json()) as { openapi?: string; info?: unknown };

		expect(res.status).toBe(200);
		expect(body).toHaveProperty("openapi");
		expect(body).toHaveProperty("info");
	});

	it("serves Better Auth OpenAPI schema at /api/auth/open-api/generate-schema", async () => {
		const request = new Request(
			"http://local.test/api/auth/open-api/generate-schema",
		);
		const res = await typedWorker.fetch(
			request,
			{
				...env,
				ENVIRONMENT: "local",
				BETTER_AUTH_SECRET: TEST_SECRET,
			},
			{} as ExecutionContext,
		);

		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			openapi?: string;
			info?: unknown;
			paths?: Record<string, unknown>;
		};

		expect(body).toHaveProperty("openapi");
		expect(body).toHaveProperty("info");
		expect(body).toHaveProperty("paths");
		// Verify some key Better Auth endpoints are documented
		expect(body.paths).toBeDefined();
	});

	it("builds OpenAPI description fallback when package description is missing", () => {
		const info = getOpenApiInfo({ name: "backend-template", version: "0.0.0" });

		expect(info.description).toBe(
			"OpenAPI documentation for backend-template (0.0.0).",
		);
	});
});
