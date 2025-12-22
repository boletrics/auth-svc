import { contentJson, OpenAPIRoute } from "chanfana";
import { AppContext } from "../../types";
import { z } from "zod";

/**
 * Better Auth endpoints documentation for OpenAPI
 * These endpoints are handled by Better Auth internally, but documented here for API reference
 */

const ErrorResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
	errors: z
		.array(
			z.object({
				code: z.number(),
				message: z.string(),
			}),
		)
		.optional(),
});

const SuccessResponseSchema = z.object({
	success: z.boolean(),
	data: z.any().optional(),
});

export class AuthSignUpEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Sign up a new user",
		operationId: "auth-sign-up",
		request: {
			body: contentJson(
				z.object({
					email: z.string().email(),
					password: z.string().min(8),
					name: z.string().optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "User created successfully",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		// This is just for OpenAPI documentation
		// Actual implementation is handled by Better Auth
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthSignInEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Sign in a user",
		operationId: "auth-sign-in",
		request: {
			body: contentJson(
				z.object({
					email: z.string().email(),
					password: z.string(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Sign in successful",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthSignOutEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Sign out the current user",
		operationId: "auth-sign-out",
		responses: {
			"200": {
				description: "Sign out successful",
				...contentJson(SuccessResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthSessionEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Get current session",
		operationId: "auth-session",
		responses: {
			"200": {
				description: "Current session data",
				...contentJson(
					z.object({
						success: z.boolean(),
						data: z
							.object({
								user: z
									.object({
										id: z.string(),
										email: z.string(),
										name: z.string().optional(),
										emailVerified: z.boolean(),
									})
									.optional(),
								session: z
									.object({
										id: z.string(),
										expiresAt: z.string(),
									})
									.optional(),
							})
							.optional(),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthJwksEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Get JSON Web Key Set (JWKS) for JWT verification",
		description:
			"Public endpoint that returns the JSON Web Key Set used to verify JWTs issued by this service. This endpoint is publicly accessible.",
		operationId: "auth-jwks",
		responses: {
			"200": {
				description: "JWKS data",
				...contentJson(
					z.object({
						keys: z.array(
							z.object({
								kty: z.string(),
								use: z.string().optional(),
								kid: z.string().optional(),
								alg: z.string().optional(),
								crv: z.string().optional(),
								x: z.string().optional(),
								y: z.string().optional(),
								n: z.string().optional(),
								e: z.string().optional(),
							}),
						),
					}),
				),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthForgotPasswordEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Request password reset",
		operationId: "auth-forgot-password",
		request: {
			body: contentJson(
				z.object({
					email: z.string().email(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Password reset email sent",
				...contentJson(SuccessResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthResetPasswordEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Authentication"],
		summary: "Reset password with token",
		operationId: "auth-reset-password",
		request: {
			body: contentJson(
				z.object({
					token: z.string(),
					password: z.string().min(8),
				}),
			),
		},
		responses: {
			"200": {
				description: "Password reset successful",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Invalid or expired token",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

// --- Organization plugin endpoints (Better Auth) ---

export class AuthOrganizationCreateEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "Create a new organization",
		operationId: "auth-organization-create",
		request: {
			body: contentJson(
				z.object({
					name: z.string(),
					slug: z.string(),
					logo: z.string().optional(),
					metadata: z.record(z.string(), z.any()).optional(),
					keepCurrentActiveOrganization: z.boolean().optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Organization created",
				...contentJson(SuccessResponseSchema),
			},
			"400": {
				description: "Bad request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationListEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "List organizations for the current user",
		operationId: "auth-organization-list",
		responses: {
			"200": {
				description: "Organizations",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationSetActiveEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "Set the active organization for the current session",
		operationId: "auth-organization-set-active",
		request: {
			body: contentJson(
				z.object({
					organizationId: z.string(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Active organization updated",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationInviteMemberEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "Invite a user to an organization by email",
		operationId: "auth-organization-invite-member",
		request: {
			body: contentJson(
				z.object({
					email: z.string().email(),
					role: z.union([z.string(), z.array(z.string())]),
					organizationId: z.string().optional(),
					resend: z.boolean().optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Invitation created",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationAcceptInvitationEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "Accept an organization invitation",
		operationId: "auth-organization-accept-invitation",
		request: {
			body: contentJson(
				z.object({
					invitationId: z.string(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Invitation accepted",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationListMembersEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "List members in an organization",
		operationId: "auth-organization-list-members",
		request: {
			query: z.object({
				organizationId: z.string().optional(),
				organizationSlug: z.string().optional(),
				limit: z.union([z.string(), z.number()]).optional(),
				offset: z.union([z.string(), z.number()]).optional(),
			}),
		},
		responses: {
			"200": {
				description: "Members",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationListInvitationsEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "List pending invitations for an organization",
		operationId: "auth-organization-list-invitations",
		request: {
			query: z.object({
				organizationId: z.string().optional(),
				organizationSlug: z.string().optional(),
				status: z
					.enum(["pending", "accepted", "rejected", "canceled"])
					.optional(),
			}),
		},
		responses: {
			"200": {
				description: "Invitations list",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}

export class AuthOrganizationCancelInvitationEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Organizations"],
		summary: "Cancel a pending invitation",
		operationId: "auth-organization-cancel-invitation",
		request: {
			body: contentJson(
				z.object({
					invitationId: z.string(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Invitation canceled",
				...contentJson(SuccessResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	public async handle(_c: AppContext) {
		throw new Error("This endpoint is handled by Better Auth");
	}
}
