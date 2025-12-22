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
	// Undici/Node Fetch provides getSetCookie(); Cloudflare may not.
	const maybe = (res.headers as any).getSetCookie?.();
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

describe("Better Auth organization plugin", () => {
	it("allows a user to be invited and added as an organization member", async () => {
		const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
		const ownerEmail = `owner-${suffix}@example.com`;
		const memberEmail = `member-${suffix}@example.com`;
		const password = `P@ssw0rd-${suffix}`;

		const bindings: Bindings = {
			...env,
			ENVIRONMENT: "test",
			BETTER_AUTH_SECRET: TEST_SECRET,
		} as Bindings;

		// Sign up owner + member accounts
		const ownerSignUp = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ownerEmail, password, name: "Owner" }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(ownerSignUp.status).toBeLessThan(500);

		const memberSignUp = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: memberEmail, password, name: "Member" }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(memberSignUp.status).toBeLessThan(500);

		// Tests run without email delivery; flip emailVerified so sign-in works.
		await bindings.DB.prepare(
			"UPDATE users SET emailVerified = 1 WHERE email IN (?, ?)",
		)
			.bind(ownerEmail, memberEmail)
			.run();

		// Sign in owner
		const ownerSignIn = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ownerEmail, password }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(ownerSignIn.status).toBe(200);
		const ownerCookie = cookieHeaderFromResponse(ownerSignIn);
		expect(ownerCookie).toContain("=");

		// Create organization as owner
		const slug = `org-${suffix}`.toLowerCase();
		const createOrg = await typedWorker.fetch(
			new Request("http://localhost/api/auth/organization/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: ownerCookie,
				},
				body: JSON.stringify({ name: "Test Org", slug }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(createOrg.status).toBe(200);
		const org = (await json(createOrg)) as { id?: string };
		expect(org.id).toBeTruthy();

		// Invite member by email
		const invite = await typedWorker.fetch(
			new Request("http://localhost/api/auth/organization/invite-member", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: ownerCookie,
				},
				body: JSON.stringify({
					email: memberEmail,
					role: "member",
					organizationId: org.id,
				}),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(invite.status).toBe(200);
		const invitation = (await json(invite)) as { id?: string };
		expect(invitation.id).toBeTruthy();

		// Sign in member
		const memberSignIn = await typedWorker.fetch(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: memberEmail, password }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(memberSignIn.status).toBe(200);
		const memberCookie = cookieHeaderFromResponse(memberSignIn);
		expect(memberCookie).toContain("=");

		// Accept invitation
		const accept = await typedWorker.fetch(
			new Request("http://localhost/api/auth/organization/accept-invitation", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: memberCookie,
				},
				body: JSON.stringify({ invitationId: invitation.id }),
			}),
			bindings,
			{} as ExecutionContext,
		);
		expect(accept.status).toBe(200);

		// List members and ensure invited user is present
		const list = await typedWorker.fetch(
			new Request(
				`http://localhost/api/auth/organization/list-members?organizationId=${encodeURIComponent(
					org.id ?? "",
				)}`,
				{
					method: "GET",
					headers: {
						Cookie: ownerCookie,
					},
				},
			),
			bindings,
			{} as ExecutionContext,
		);
		expect(list.status).toBe(200);
		const listBody = (await json(list)) as {
			members?: Array<{ user?: { email?: string } }>;
		};
		const emails = (listBody.members ?? [])
			.map((m) => m.user?.email)
			.filter(Boolean);
		expect(emails).toContain(memberEmail);
	});
});
