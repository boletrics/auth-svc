import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";

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
		res.headers as Headers & { getSetCookie?: () => string[] }
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

async function json(res: Response) {
	const text = await res.text();
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error(`Expected JSON response, got: ${text.slice(0, 300)}`);
	}
}

describe("Admin Organizations API", () => {
	const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const adminEmail = `admin-${suffix}@example.com`;
	const userEmail = `user-${suffix}@example.com`;
	const password = `P@ssw0rd-${suffix}`;

	let bindings: Bindings;
	let adminCookie: string;
	let userCookie: string;
	let orgId: string;

	beforeAll(async () => {
		bindings = {
			...env,
			ENVIRONMENT: "test",
			BETTER_AUTH_SECRET: TEST_SECRET,
		} as Bindings;

		// Sign up admin account
		const adminSignUp = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: adminEmail, password, name: "Admin" }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(adminSignUp.status).toBeLessThan(500);

		// Sign up regular user account
		const userSignUp = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: userEmail, password, name: "User" }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(userSignUp.status).toBeLessThan(500);

		// Verify emails and set admin role
		await bindings.DB.prepare(
			"UPDATE users SET emailVerified = 1, role = 'admin' WHERE email = ?",
		)
			.bind(adminEmail)
			.run();
		await bindings.DB.prepare(
			"UPDATE users SET emailVerified = 1 WHERE email = ?",
		)
			.bind(userEmail)
			.run();

		// Sign in admin
		const adminSignIn = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: adminEmail, password }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(adminSignIn.status).toBe(200);
		adminCookie = cookieHeaderFromResponse(adminSignIn);

		// Sign in user
		const userSignIn = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: userEmail, password }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(userSignIn.status).toBe(200);
		userCookie = cookieHeaderFromResponse(userSignIn);

		// Create an organization as admin
		const slug = `org-${suffix}`.toLowerCase();
		const createOrg = await typedWorker.fetch(
			new Request("http://localhost/api/auth/organization/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({ name: "Test Org", slug }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(createOrg.status).toBe(200);
		const org = (await json(createOrg)) as { id?: string };
		orgId = org.id!;
	});

	describe("GET /admin/organizations", () => {
		it("returns 401 for unauthenticated requests", async () => {
			const request = new Request("http://localhost/admin/organizations");
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(401);
			const body = (await json(response)) as { error?: string };
			expect(body.error).toBe("Not authenticated");
		});

		it("returns 403 for non-admin users", async () => {
			const request = new Request("http://localhost/admin/organizations", {
				headers: { Cookie: userCookie },
			});
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(403);
			const body = (await json(response)) as { error?: string };
			expect(body.error).toBe("Not authorized");
		});

		it("returns organizations for admin users", async () => {
			const request = new Request("http://localhost/admin/organizations", {
				headers: { Cookie: adminCookie },
			});
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				success?: boolean;
				result?: { data?: unknown[]; pagination?: unknown };
			};
			expect(body.success).toBe(true);
			expect(body.result?.data).toBeDefined();
			expect(body.result?.pagination).toBeDefined();
		});

		it("supports pagination parameters", async () => {
			const request = new Request(
				"http://localhost/admin/organizations?page=1&limit=10",
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				result?: { pagination?: { page?: number; limit?: number } };
			};
			expect(body.result?.pagination?.page).toBe(1);
			expect(body.result?.pagination?.limit).toBe(10);
		});

		it("supports search parameter", async () => {
			const request = new Request(
				"http://localhost/admin/organizations?search=Test",
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				success?: boolean;
				result?: { data?: Array<{ name?: string }> };
			};
			expect(body.success).toBe(true);
			// Should find the "Test Org" we created
			const hasMatch = body.result?.data?.some((org) =>
				org.name?.includes("Test"),
			);
			expect(hasMatch).toBe(true);
		});

		it("clamps limit to maximum of 100", async () => {
			const request = new Request(
				"http://localhost/admin/organizations?limit=200",
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				result?: { pagination?: { limit?: number } };
			};
			expect(body.result?.pagination?.limit).toBe(100);
		});

		it("clamps page to minimum of 1", async () => {
			const request = new Request(
				"http://localhost/admin/organizations?page=0",
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				result?: { pagination?: { page?: number } };
			};
			expect(body.result?.pagination?.page).toBe(1);
		});
	});

	describe("GET /admin/organizations/:id", () => {
		it("returns 401 for unauthenticated requests", async () => {
			const request = new Request(
				`http://localhost/admin/organizations/${orgId}`,
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(401);
		});

		it("returns 403 for non-admin users", async () => {
			const request = new Request(
				`http://localhost/admin/organizations/${orgId}`,
				{ headers: { Cookie: userCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(403);
		});

		it("returns 404 for non-existent organization", async () => {
			const request = new Request(
				"http://localhost/admin/organizations/non-existent-id",
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(404);
			const body = (await json(response)) as { error?: string };
			expect(body.error).toBe("Organization not found");
		});

		it("returns organization details for admin users", async () => {
			const request = new Request(
				`http://localhost/admin/organizations/${orgId}`,
				{ headers: { Cookie: adminCookie } },
			);
			const response = await typedWorker.fetch(
				request,
				bindings,
				{} as ExecutionContext,
			);

			expect(response.status).toBe(200);
			const body = (await json(response)) as {
				success?: boolean;
				result?: {
					id?: string;
					name?: string;
					members?: unknown[];
				};
			};
			expect(body.success).toBe(true);
			expect(body.result?.id).toBe(orgId);
			expect(body.result?.name).toBe("Test Org");
			expect(body.result?.members).toBeDefined();
		});
	});
});
