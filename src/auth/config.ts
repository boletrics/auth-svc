import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { emailOTP } from "better-auth/plugins/email-otp";
import { jwt } from "better-auth/plugins/jwt";
import { organization } from "better-auth/plugins/organization";
import { openAPI } from "better-auth/plugins";

import type { Bindings, BoletricsEnvironment } from "../types/bindings";
import { sendPasswordResetEmail, sendOtpEmail } from "../utils/mandrill";
import { sendOrganizationInvitationEmail } from "../utils/mandrill";

const BASE_PATH = "/api/auth";
const ORG_SLUG = "boletrics";

const ENVIRONMENT_MAP: Record<string, BoletricsEnvironment> = {
	dev: "dev",
	development: "dev",
	qa: "qa",
	test: "test",
	testing: "test",
	prod: "production",
	production: "production",
	preview: "preview",
	local: "local",
};

const RATE_LIMITS: Record<
	BoletricsEnvironment,
	{ window: number; max: number; enabled: boolean }
> = {
	local: { window: 10, max: 300, enabled: false },
	preview: { window: 10, max: 120, enabled: true },
	dev: { window: 10, max: 90, enabled: true },
	qa: { window: 10, max: 80, enabled: true },
	production: { window: 10, max: 60, enabled: true },
	test: { window: 10, max: 60, enabled: false },
};

const COOKIE_DOMAIN_BY_ENV: Partial<Record<BoletricsEnvironment, string>> = {
	preview: ".boletrics.workers.dev",
	dev: ".boletrics.workers.dev",
	qa: ".boletrics.workers.dev",
	production: ".boletrics.workers.dev",
};

const TRUSTED_ORIGINS_BY_ENV: Partial<Record<BoletricsEnvironment, string[]>> =
	{
		preview: ["https://*.boletrics.workers.dev"],
		dev: ["https://*.boletrics.workers.dev"],
		qa: ["https://*.boletrics.workers.dev"],
		production: ["https://*.boletrics.workers.dev"],
	};

const LOCAL_DEVELOPMENT_ORIGINS = [
	"http://localhost:*",
	"https://localhost:*",
	"http://127.0.0.1:*",
	"https://127.0.0.1:*",
];

const CROSS_SUBDOMAIN_ENVS: ReadonlySet<BoletricsEnvironment> = new Set([
	"preview",
	"dev",
	"qa",
	"production",
]);

export type AuthAccessPolicy = {
	enforceInternal: boolean;
	token?: string;
};

export type ResolvedAuthConfig = {
	cacheKey: string;
	secret: string;
	options: BetterAuthOptions;
	accessPolicy: AuthAccessPolicy;
};

export function resolveAuthEnvironment(env: Bindings): BoletricsEnvironment {
	const fallback = env.ENVIRONMENT?.toLowerCase?.() ?? "local";
	return ENVIRONMENT_MAP[fallback] ?? "local";
}

export function buildResolvedAuthConfig(
	env: Bindings,
	executionContext?: ExecutionContext,
): ResolvedAuthConfig {
	const resolvedEnv = resolveAuthEnvironment(env);
	const secret = resolveSecret(env.BETTER_AUTH_SECRET, resolvedEnv);
	const baseURL = resolveBaseURL(env.BETTER_AUTH_URL, resolvedEnv);
	const accessPolicy = resolveAccessPolicy(env, resolvedEnv);
	const cookieDomain = resolveCookieDomain(env, resolvedEnv);
	const trustedOrigins = resolveTrustedOrigins(env, resolvedEnv, cookieDomain);

	const options: BetterAuthOptions = {
		appName: `${ORG_SLUG}-auth-core-${resolvedEnv}`,
		basePath: BASE_PATH,
		baseURL,
		secret,
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: async ({ user, token }, _request) => {
				const apiKey = env.MANDRILL_API_KEY;
				if (!apiKey) {
					console.error("[Password Reset] MANDRILL_API_KEY is not configured");
					return;
				}

				// Construct frontend URL with token for direct password reset
				// Instead of using Better Auth's backend redirect URL, we send users
				// directly to the frontend which calls the API to reset password
				const frontendBaseUrl =
					env.AUTH_FRONTEND_URL || "https://auth.boletrics.workers.dev";
				const resetUrl = `${frontendBaseUrl}/recover/reset?token=${encodeURIComponent(token)}`;

				// Use waitUntil for Cloudflare Workers to ensure async operation completes
				// Better Auth documentation recommends not awaiting email sending to prevent timing attacks
				const emailPromise = sendPasswordResetEmail(
					apiKey,
					user.email,
					user.name || user.email,
					resetUrl,
					"boletrics-auth-password-recovery-template",
				);

				// Use waitUntil if execution context is available (Cloudflare Workers)
				if (
					executionContext &&
					typeof executionContext.waitUntil === "function"
				) {
					executionContext.waitUntil(emailPromise);
				} else {
					// Fallback: ensure promise completes and errors are handled
					emailPromise.catch((error) => {
						console.error(
							"[Password Reset] Unhandled email promise rejection",
							error,
						);
					});
				}
			},
			onPasswordReset: async ({ user }, _request) => {
				// Optional callback after password reset is successful
				// Log for audit purposes or trigger additional actions
				console.log(`Password reset completed for user: ${user.email}`);
			},
		},
		// Note: Email verification is handled by the emailOTP plugin below
		// No link-based verification - all verification uses OTP codes
		plugins: [
			openAPI({
				// Better Auth's OpenAPI plugin generates:
				// 1. A reference page at /api/auth/reference (Scalar UI)
				// 2. The JSON schema endpoint at /api/auth/open-api/generate-schema
				path: "/reference",
			}),
			jwt({
				jwks: {
					// Exposed as `${basePath}/jwks` (i.e. `/api/auth/jwks`)
					jwksPath: "/jwks",
				},
				jwt: {
					expirationTime: resolvedEnv === "production" ? "15m" : "30m",
				},
			}),
			admin({
				// Admin users can manage all users, roles, and perform admin operations
				// Users with "admin" role or in adminUserIds list get admin privileges
				defaultRole: "user",
				adminRoles: ["admin"],
			}),
			organization({
				// Organization membership support (users <-> organizations).
				// We keep teams disabled for now; can be enabled later without breaking the API surface.
				// Note: Prisma's @@map directives handle the plural table name mapping.
				teams: { enabled: false },
				sendInvitationEmail: async (data) => {
					const apiKey = env.MANDRILL_API_KEY;
					if (!apiKey) {
						console.error(
							"[Org Invitation] MANDRILL_API_KEY is not configured; invitation email skipped",
						);
						return;
					}

					// Invitation acceptance happens in the partner app, not the auth app
					const partnerAppUrl =
						env.PARTNER_APP_URL || "https://partner.boletrics.workers.dev";

					const invitationId = data.invitation?.id ?? data.id ?? "";

					const inviteUrl = invitationId
						? `${partnerAppUrl}/invitations/accept?invitationId=${encodeURIComponent(invitationId)}`
						: `${partnerAppUrl}/invitations`;

					const organizationName = data.organization?.name ?? "tu organización";
					// inviter is a member with nested user info
					const inviterUser = data.inviter?.user;
					const inviterName =
						inviterUser?.name ?? inviterUser?.email ?? "Boletrics";
					const email = data.email ?? "";

					if (!email) {
						console.error(
							"[Org Invitation] Missing recipient email; invitation email skipped",
						);
						return;
					}

					const invitationPromise = sendOrganizationInvitationEmail(apiKey, {
						email,
						inviteUrl,
						organizationName,
						inviterName,
						role: data.role,
					});

					if (
						executionContext &&
						typeof executionContext.waitUntil === "function"
					) {
						executionContext.waitUntil(invitationPromise);
					} else {
						// Fallback: ensure promise completes and errors are handled
						invitationPromise.catch((error) => {
							console.error(
								"[Org Invitation] Unhandled email promise rejection",
								error,
							);
						});
					}
				},
			}),
			emailOTP({
				otpLength: 6,
				expiresIn: 300, // 5 minutes
				// Replace default email verification link with OTP
				// This ensures signup flow stays in-app and preserves redirectTo
				disableSignUp: false,
				// Override the default email verification with OTP-based verification
				// This means no email links are sent - only OTP codes
				sendVerificationOnSignUp: true,
				async sendVerificationOTP({ email, otp, type }) {
					const apiKey = env.MANDRILL_API_KEY;
					if (!apiKey) {
						console.error(
							"[Email OTP] MANDRILL_API_KEY is not configured; OTP email skipped",
						);
						return;
					}

					// Use waitUntil for Cloudflare Workers to ensure async operation completes
					const emailPromise = sendOtpEmail(
						apiKey,
						email,
						email.split("@")[0], // Use email prefix as fallback name
						otp,
						type,
					);

					if (
						executionContext &&
						typeof executionContext.waitUntil === "function"
					) {
						executionContext.waitUntil(emailPromise);
					} else {
						emailPromise.catch((error) => {
							console.error(
								"[Email OTP] Unhandled email promise rejection",
								error,
							);
						});
					}
				},
			}),
		],
		session: {
			updateAge: 60 * 30,
			expiresIn:
				resolvedEnv === "production" ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 14,
			freshAge: 60 * 15,
			cookieCache: {
				enabled: true,
				strategy: "jwe",
				refreshCache: true,
			},
		},
		rateLimit: RATE_LIMITS[resolvedEnv],
		advanced: buildAdvancedOptions(resolvedEnv, cookieDomain),
		trustedOrigins,
	};

	return {
		cacheKey: `${ORG_SLUG}-${resolvedEnv}`,
		secret,
		options,
		accessPolicy,
	};
}

function buildAdvancedOptions(
	env: BoletricsEnvironment,
	cookieDomain: string | undefined,
): BetterAuthOptions["advanced"] {
	const advanced: BetterAuthOptions["advanced"] = {
		disableCSRFCheck: env === "local" || env === "test",
		disableOriginCheck: env === "local" || env === "test",
		useSecureCookies: env !== "local" && env !== "test",
		// Explicitly set cookie path to "/" so cookies are accessible on all paths.
		// Without this, cookies might only be sent to paths matching the basePath (/api/auth).
		defaultCookieAttributes: {
			path: "/",
			sameSite: "lax",
		},
	};

	if (shouldEnableCrossSubdomainCookies(env, cookieDomain)) {
		advanced.crossSubDomainCookies = {
			enabled: true,
			domain: cookieDomain,
		};
	}

	return advanced;
}

function resolveSecret(secret: string | undefined, env: BoletricsEnvironment) {
	if (secret && secret.length >= 32) {
		return secret;
	}

	if (env === "local" || env === "test") {
		return "local-dev-secret-please-override-0123456789";
	}

	throw new Error(
		"BETTER_AUTH_SECRET is not configured or too short. Set a >=32 char secret via `wrangler secret put BETTER_AUTH_SECRET`.",
	);
}

function resolveBaseURL(
	baseURL: string | undefined,
	env: BoletricsEnvironment,
): string | undefined {
	// baseURL is optional for local/test environments where Better Auth can infer it
	if (env === "local" || env === "test") {
		return baseURL;
	}

	// For production environments, baseURL should be set for proper JWT issuer/audience validation
	if (!baseURL || baseURL.trim().length === 0) {
		throw new Error(
			"BETTER_AUTH_URL is required for non-local environments. Set it via environment variable or `wrangler secret put BETTER_AUTH_URL`.",
		);
	}

	// Validate URL format
	try {
		const url = new URL(baseURL);
		if (!["http:", "https:"].includes(url.protocol)) {
			throw new Error("BETTER_AUTH_URL must use http:// or https:// protocol.");
		}
	} catch (error) {
		if (error instanceof TypeError) {
			throw new Error(
				`BETTER_AUTH_URL must be a valid URL. Received: ${baseURL}`,
			);
		}
		throw error;
	}

	return baseURL.trim();
}

function resolveAccessPolicy(
	env: Bindings,
	resolvedEnv: BoletricsEnvironment,
): AuthAccessPolicy {
	const enforceInternal = resolvedEnv !== "local" && resolvedEnv !== "test";
	const token = env.AUTH_INTERNAL_TOKEN;

	if (enforceInternal && (!token || token.length < 16)) {
		throw new Error(
			"AUTH_INTERNAL_TOKEN is required for non-local environments. Configure it via `wrangler secret put AUTH_INTERNAL_TOKEN`.",
		);
	}

	return token
		? {
				enforceInternal,
				token,
			}
		: {
				enforceInternal,
			};
}

function resolveCookieDomain(env: Bindings, resolvedEnv: BoletricsEnvironment) {
	const override = normalizeCookieDomain(env.AUTH_COOKIE_DOMAIN);
	if (override) {
		return override;
	}

	return COOKIE_DOMAIN_BY_ENV[resolvedEnv];
}

function normalizeCookieDomain(domain: string | undefined) {
	if (!domain) {
		return undefined;
	}

	const cleaned = domain.trim().toLowerCase();
	if (!cleaned) {
		return undefined;
	}

	if (!cleaned.includes(".")) {
		throw new Error(
			'AUTH_COOKIE_DOMAIN must include a "." (example: .example.com).',
		);
	}

	if (cleaned.includes("*")) {
		throw new Error(
			"AUTH_COOKIE_DOMAIN does not support wildcard values. Provide a concrete domain such as .example.com",
		);
	}

	return cleaned.startsWith(".") ? cleaned : `.${cleaned}`;
}

function shouldEnableCrossSubdomainCookies(
	env: BoletricsEnvironment,
	cookieDomain?: string,
): cookieDomain is string {
	return CROSS_SUBDOMAIN_ENVS.has(env) && !!cookieDomain;
}

function resolveTrustedOrigins(
	env: Bindings,
	resolvedEnv: BoletricsEnvironment,
	cookieDomain?: string,
) {
	const origins = new Set<string>();

	// Prioritize AUTH_TRUSTED_ORIGINS from wrangler vars over ENVIRONMENT-based defaults
	const explicitTrustedOrigins = parseList(env.AUTH_TRUSTED_ORIGINS);
	if (explicitTrustedOrigins.length > 0) {
		// If AUTH_TRUSTED_ORIGINS is set, use it and skip ENVIRONMENT-based defaults
		explicitTrustedOrigins.forEach((origin) => origins.add(origin));
	} else {
		// Fallback to ENVIRONMENT-based defaults only if AUTH_TRUSTED_ORIGINS is not set
		(TRUSTED_ORIGINS_BY_ENV[resolvedEnv] ?? []).forEach((origin) =>
			origins.add(origin),
		);
	}

	// Always add localhost origins for local/test environments
	if (resolvedEnv === "local" || resolvedEnv === "test") {
		LOCAL_DEVELOPMENT_ORIGINS.forEach((origin) => origins.add(origin));
	}

	// Add domain-based patterns from cookieDomain (for cross-subdomain cookies)
	domainToTrustedOriginPatterns(cookieDomain).forEach((origin) =>
		origins.add(origin),
	);

	return Array.from(origins).filter(Boolean);
}

function domainToTrustedOriginPatterns(domain?: string) {
	if (!domain) {
		return [];
	}

	const sanitized = domain.replace(/^\./, "");
	if (!sanitized) {
		return [];
	}

	return [`https://${sanitized}`, `https://*.${sanitized}`];
}

function parseList(value: string | undefined) {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}
