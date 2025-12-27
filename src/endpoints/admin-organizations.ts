import { Hono } from "hono";
import type { Bindings } from "../types/bindings";
import { getBetterAuthContext, createPrismaClient } from "../auth/instance";
import type { Organization, Member, User } from "@prisma/client";

/**
 * Admin Organizations Router
 *
 * Provides endpoints for platform admins to list and manage all organizations.
 * These endpoints bypass Better Auth's organization plugin (which only shows
 * organizations a user is a member of) and query the database directly.
 */
export const adminOrganizationsRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Verify the current user has admin role.
 */
async function verifyAdminRole(
	env: Bindings,
	request: Request,
): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
	const { auth } = getBetterAuthContext(env);

	// Get the session from the request
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return { isAdmin: false, error: "Not authenticated" };
	}

	// Check if user has admin role
	const user = session.user as { id: string; role?: string };
	if (user.role !== "admin") {
		return { isAdmin: false, userId: user.id, error: "Not authorized" };
	}

	return { isAdmin: true, userId: user.id };
}

/**
 * GET /admin/organizations
 *
 * List all organizations (admin only).
 */
adminOrganizationsRouter.get("/", async (c) => {
	const adminCheck = await verifyAdminRole(c.env, c.req.raw);

	if (!adminCheck.isAdmin) {
		return c.json(
			{ error: adminCheck.error },
			adminCheck.error === "Not authenticated" ? 401 : 403,
		);
	}

	const prisma = createPrismaClient(c.env.DB);

	try {
		// Parse query params
		const { searchParams } = new URL(c.req.url);
		const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
		const limit = Math.min(
			100,
			Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
		);
		const search = searchParams.get("search") ?? "";
		const offset = (page - 1) * limit;

		// Build where clause
		const whereClause = search
			? {
					OR: [{ name: { contains: search } }, { slug: { contains: search } }],
				}
			: {};

		// Get total count
		const total = await prisma.organization.count({
			where: whereClause,
		});

		// Get organizations with member count
		const organizations = await prisma.organization.findMany({
			where: whereClause,
			include: {
				_count: {
					select: { members: true },
				},
			},
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
		});

		// Transform to response format
		type OrgWithCount = Organization & { _count: { members: number } };
		const data = organizations.map((org: OrgWithCount) => ({
			id: org.id,
			name: org.name,
			slug: org.slug,
			logo: org.logo,
			metadata: org.metadata ? JSON.parse(org.metadata) : null,
			createdAt: org.createdAt.toISOString(),
			member_count: org._count.members,
		}));

		return c.json({
			success: true,
			result: {
				data,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			},
		});
	} catch (error) {
		console.error("Failed to list organizations:", error);
		return c.json({ error: "Failed to list organizations" }, 500);
	}
});

/**
 * GET /admin/organizations/:id
 *
 * Get a single organization by ID (admin only).
 */
adminOrganizationsRouter.get("/:id", async (c) => {
	const adminCheck = await verifyAdminRole(c.env, c.req.raw);

	if (!adminCheck.isAdmin) {
		return c.json(
			{ error: adminCheck.error },
			adminCheck.error === "Not authenticated" ? 401 : 403,
		);
	}

	const prisma = createPrismaClient(c.env.DB);
	const orgId = c.req.param("id");

	try {
		const organization = await prisma.organization.findUnique({
			where: { id: orgId },
			include: {
				_count: {
					select: { members: true },
				},
				members: {
					include: {
						user: {
							select: {
								id: true,
								email: true,
								name: true,
								image: true,
							},
						},
					},
				},
			},
		});

		if (!organization) {
			return c.json({ error: "Organization not found" }, 404);
		}

		type MemberWithUser = Member & {
			user: Pick<User, "id" | "email" | "name" | "image">;
		};
		return c.json({
			success: true,
			result: {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
				metadata: organization.metadata
					? JSON.parse(organization.metadata)
					: null,
				createdAt: organization.createdAt.toISOString(),
				member_count: organization._count.members,
				members: organization.members.map((m: MemberWithUser) => ({
					id: m.id,
					role: m.role,
					createdAt: m.createdAt.toISOString(),
					user: m.user,
				})),
			},
		});
	} catch (error) {
		console.error("Failed to get organization:", error);
		return c.json({ error: "Failed to get organization" }, 500);
	}
});
