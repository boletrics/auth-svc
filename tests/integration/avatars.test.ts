import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../src/testWorker";
import type { Bindings } from "../../src/types/bindings";

const typedWorker = worker as unknown as {
	fetch: (
		request: Request,
		env: unknown,
		ctx: ExecutionContext,
	) => Promise<Response>;
};

const TEST_SECRET = "test-secret-1234567890123456789012345";

function getSetCookies(res: Response): string[] {
	const maybe = (
		res.headers as unknown as { getSetCookie?: () => string[] }
	).getSetCookie?.();
	if (Array.isArray(maybe) && maybe.length > 0) return maybe;
	const single = res.headers.get("set-cookie");
	return single ? [single] : [];
}

function cookieHeaderFromResponse(res: Response): string {
	return getSetCookies(res)
		.map((c) => c.split(";")[0])
		.filter(Boolean)
		.join("; ");
}

describe("Avatar endpoints", () => {
	describe("Authentication", () => {
		it("rejects unauthenticated requests to upload-url endpoint", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
			} as Bindings;

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/upload-url", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(401);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ code: number; message: string }>;
			};
			expect(body.success).toBe(false);
			expect(body.errors[0].code).toBe(401);
			expect(body.errors[0].message).toContain("Unauthorized");
		});

		it("rejects unauthenticated requests to delete endpoint", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
			} as Bindings;

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/some-image-id", {
					method: "DELETE",
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(401);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ code: number; message: string }>;
			};
			expect(body.success).toBe(false);
			expect(body.errors[0].code).toBe(401);
		});

		it("rejects unauthenticated requests to delivery-url endpoint", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
			} as Bindings;

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/delivery-url/some-image-id", {
					method: "GET",
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(401);
		});
	});

	describe("Authenticated requests", () => {
		async function signUpAndSignIn(bindings: Bindings): Promise<string> {
			const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
			const email = `avatar-test-${suffix}@example.com`;
			const password = `P@ssw0rd-${suffix}`;

			// Sign up
			await typedWorker.fetch(
				new Request("http://localhost/api/auth/sign-up/email", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, password, name: "Avatar Test" }),
				}),
				bindings,
				{} as ExecutionContext,
			);

			// Verify email directly in DB
			await bindings.DB.prepare(
				"UPDATE users SET emailVerified = 1 WHERE email = ?",
			)
				.bind(email)
				.run();

			// Sign in
			const signIn = await typedWorker.fetch(
				new Request("http://localhost/api/auth/sign-in/email", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, password }),
				}),
				bindings,
				{} as ExecutionContext,
			);

			return cookieHeaderFromResponse(signIn);
		}

		it("returns delivery URL for authenticated requests when CLOUDFLARE_IMAGES_HASH is set", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
				CLOUDFLARE_IMAGES_HASH: "test-hash-123",
			} as Bindings;

			const cookie = await signUpAndSignIn(bindings);

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/delivery-url/test-image-id", {
					method: "GET",
					headers: { Cookie: cookie },
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				success: boolean;
				result: { deliveryUrl: string };
			};
			expect(body.success).toBe(true);
			expect(body.result.deliveryUrl).toContain("imagedelivery.net");
			expect(body.result.deliveryUrl).toContain("test-hash-123");
			expect(body.result.deliveryUrl).toContain("test-image-id");
		});

		it("returns delivery URL with custom variant", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
				CLOUDFLARE_IMAGES_HASH: "test-hash-123",
			} as Bindings;

			const cookie = await signUpAndSignIn(bindings);

			const response = await typedWorker.fetch(
				new Request(
					"http://localhost/avatars/delivery-url/test-image-id?variant=thumbnail",
					{
						method: "GET",
						headers: { Cookie: cookie },
					},
				),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				success: boolean;
				result: { deliveryUrl: string };
			};
			expect(body.result.deliveryUrl).toContain("thumbnail");
		});

		it("returns 500 when CLOUDFLARE_IMAGES_HASH is not configured for delivery-url", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
				// No CLOUDFLARE_IMAGES_HASH
			} as Bindings;

			const cookie = await signUpAndSignIn(bindings);

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/delivery-url/test-image-id", {
					method: "GET",
					headers: { Cookie: cookie },
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(500);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ code: number; message: string }>;
			};
			expect(body.success).toBe(false);
			expect(body.errors[0].message).toContain("CLOUDFLARE_IMAGES_HASH");
		});

		it("returns 500 when Cloudflare Images is not fully configured for upload-url", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
				// Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGES_TOKEN, CLOUDFLARE_IMAGES_HASH
			} as Bindings;

			const cookie = await signUpAndSignIn(bindings);

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/upload-url", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: cookie,
					},
					body: JSON.stringify({}),
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(500);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ code: number; message: string }>;
			};
			expect(body.success).toBe(false);
			expect(body.errors[0].message).toContain(
				"Cloudflare Images not configured",
			);
		});

		it("returns 500 when Cloudflare Images is not fully configured for delete", async () => {
			const bindings: Bindings = {
				...env,
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: TEST_SECRET,
				// Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGES_TOKEN, CLOUDFLARE_IMAGES_HASH
			} as Bindings;

			const cookie = await signUpAndSignIn(bindings);

			const response = await typedWorker.fetch(
				new Request("http://localhost/avatars/some-image-id", {
					method: "DELETE",
					headers: { Cookie: cookie },
				}),
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(500);
			const body = (await response.json()) as {
				success: boolean;
				errors: Array<{ code: number; message: string }>;
			};
			expect(body.success).toBe(false);
			expect(body.errors[0].message).toContain(
				"Cloudflare Images not configured",
			);
		});
	});
});
