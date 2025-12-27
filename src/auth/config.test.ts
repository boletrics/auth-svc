import { describe, expect, it } from "vitest";

import { buildResolvedAuthConfig, resolveAuthEnvironment } from "./config";
import type { Bindings } from "../types/bindings";

const SECRET = "test-secret-123456789012345678901234567890";
const INTERNAL_TOKEN = "internal-token-123456";

const baseEnv: Bindings = {
	DB: {} as D1Database,
	ENVIRONMENT: "local",
	BETTER_AUTH_SECRET: SECRET,
	AUTH_INTERNAL_TOKEN: INTERNAL_TOKEN,
} as Bindings;

function buildEnv(overrides: Partial<Bindings> = {}) {
	return {
		...baseEnv,
		...overrides,
	} satisfies Bindings;
}

function buildEnvWithoutInternalToken(overrides: Partial<Bindings> = {}) {
	const env = buildEnv(overrides);
	delete env.AUTH_INTERNAL_TOKEN;
	return env;
}

describe("resolveAuthEnvironment", () => {
	it("returns local for undefined ENVIRONMENT", () => {
		expect(resolveAuthEnvironment({ ENVIRONMENT: undefined } as Bindings)).toBe(
			"local",
		);
	});

	it("returns local for unknown environment", () => {
		expect(resolveAuthEnvironment({ ENVIRONMENT: "unknown" } as Bindings)).toBe(
			"local",
		);
	});

	it("maps development to dev", () => {
		expect(
			resolveAuthEnvironment({ ENVIRONMENT: "development" } as Bindings),
		).toBe("dev");
	});

	it("maps testing to test", () => {
		expect(resolveAuthEnvironment({ ENVIRONMENT: "testing" } as Bindings)).toBe(
			"test",
		);
	});

	it("maps prod to production", () => {
		expect(resolveAuthEnvironment({ ENVIRONMENT: "prod" } as Bindings)).toBe(
			"production",
		);
	});

	it("handles case-insensitive environment names", () => {
		expect(resolveAuthEnvironment({ ENVIRONMENT: "DEV" } as Bindings)).toBe(
			"dev",
		);
		expect(
			resolveAuthEnvironment({ ENVIRONMENT: "PRODUCTION" } as Bindings),
		).toBe("production");
	});
});

describe("buildResolvedAuthConfig", () => {
	it("enables cross-subdomain cookies for dev and allows *.boletrics.workers.dev origins", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".boletrics.workers.dev",
		});
		expect(config.options.trustedOrigins).toContain(
			"https://*.boletrics.workers.dev",
		);
		expect(config.options.advanced?.useSecureCookies).toBe(true);
		// JWT/JWKS plugin is enabled by default
		expect(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(config.options as any).plugins?.some(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(plugin: any) => plugin?.id === "jwt",
			),
		).toBe(true);
		// Organization plugin is enabled by default
		expect(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(config.options as any).plugins?.some(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(plugin: any) => plugin?.id === "organization",
			),
		).toBe(true);
	});

	it("uses boletrics.workers.dev for QA environment (no separate QA domain)", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "qa",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".boletrics.workers.dev",
		});
		expect(config.options.trustedOrigins).toContain(
			"https://*.boletrics.workers.dev",
		);
	});

	it("uses custom cookie domain and trusted origins overrides in production", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "production",
				BETTER_AUTH_URL: "https://auth-core.boletrics.com",
				AUTH_COOKIE_DOMAIN: "login.client.com",
				AUTH_TRUSTED_ORIGINS:
					"https://portal.client.com,https://*.client-staging.com",
			}),
		);

		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".login.client.com",
		});
		// When AUTH_TRUSTED_ORIGINS is explicitly set, it replaces ENVIRONMENT-based defaults
		// but domain-based patterns from cookieDomain are still added
		expect(config.options.trustedOrigins).toEqual(
			expect.arrayContaining([
				"https://portal.client.com",
				"https://*.client-staging.com",
				"https://login.client.com",
				"https://*.login.client.com",
			]),
		);
		// ENVIRONMENT-based default should NOT be included when AUTH_TRUSTED_ORIGINS is set
		expect(config.options.trustedOrigins).not.toContain(
			"https://*.boletrics.com",
		);
	});

	it("keeps localhost origins for local env without cross-subdomain cookies", () => {
		const config = buildResolvedAuthConfig(
			buildEnvWithoutInternalToken({ ENVIRONMENT: "local" }),
		);

		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".boletrics.workers.dev",
		});
		expect(config.options.trustedOrigins).toEqual(
			expect.arrayContaining(["http://localhost:*", "https://localhost:*"]),
		);
	});

	it("passes BETTER_AUTH_URL through as baseURL when provided", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((config.options as any).baseURL).toBe(
			"https://auth-core.boletrics.workers.dev",
		);
	});

	it("allows missing BETTER_AUTH_URL in local environment", () => {
		const config = buildResolvedAuthConfig(
			buildEnvWithoutInternalToken({
				ENVIRONMENT: "local",
			}),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((config.options as any).baseURL).toBeUndefined();
	});

	it("requires BETTER_AUTH_URL in production environment", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "production",
					BETTER_AUTH_URL: undefined,
				}),
			);
		}).toThrow("BETTER_AUTH_URL is required for non-local environments");
	});

	it("validates BETTER_AUTH_URL format", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "not-a-valid-url",
				}),
			);
		}).toThrow("BETTER_AUTH_URL must be a valid URL");

		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "ftp://invalid-protocol.com",
				}),
			);
		}).toThrow("BETTER_AUTH_URL must use http:// or https:// protocol");
	});

	it("trims whitespace from BETTER_AUTH_URL", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "  https://auth-core.boletrics.workers.dev  ",
			}),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((config.options as any).baseURL).toBe(
			"https://auth-core.boletrics.workers.dev",
		);
	});

	it("requires AUTH_INTERNAL_TOKEN for non-local environments", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnvWithoutInternalToken({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
				}),
			);
		}).toThrow("AUTH_INTERNAL_TOKEN is required for non-local environments");
	});

	it("requires AUTH_INTERNAL_TOKEN to be at least 16 characters", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
					AUTH_INTERNAL_TOKEN: "short",
				}),
			);
		}).toThrow("AUTH_INTERNAL_TOKEN is required for non-local environments");
	});

	it("uses fallback secret for local environment when not provided", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "local",
				BETTER_AUTH_SECRET: undefined,
			}),
		);

		expect(config.secret).toBe("local-dev-secret-please-override-0123456789");
	});

	it("uses fallback secret for test environment when not provided", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "test",
				BETTER_AUTH_SECRET: undefined,
			}),
		);

		expect(config.secret).toBe("local-dev-secret-please-override-0123456789");
	});

	it("throws error when secret is too short in production", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "production",
					BETTER_AUTH_URL: "https://auth-core.boletrics.com",
					BETTER_AUTH_SECRET: "tooshort",
				}),
			);
		}).toThrow("BETTER_AUTH_SECRET is not configured or too short");
	});

	it("throws error for invalid cookie domain format", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
					AUTH_COOKIE_DOMAIN: "nodots",
				}),
			);
		}).toThrow('AUTH_COOKIE_DOMAIN must include a "."');
	});

	it("throws error for wildcard cookie domain", () => {
		expect(() => {
			buildResolvedAuthConfig(
				buildEnv({
					ENVIRONMENT: "dev",
					BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
					AUTH_COOKIE_DOMAIN: "*.example.com",
				}),
			);
		}).toThrow("AUTH_COOKIE_DOMAIN does not support wildcard values");
	});

	it("normalizes cookie domain by adding leading dot", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
				AUTH_COOKIE_DOMAIN: "example.com",
			}),
		);

		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".example.com",
		});
	});

	it("handles empty AUTH_COOKIE_DOMAIN", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
				AUTH_COOKIE_DOMAIN: "   ",
			}),
		);

		// Should fall back to environment default
		expect(config.options.advanced?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".boletrics.workers.dev",
		});
	});

	it("disables secure cookies for test environment", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "test",
			}),
		);

		expect(config.options.advanced?.useSecureCookies).toBe(false);
	});

	it("enables secure cookies for local environment", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "local",
			}),
		);

		expect(config.options.advanced?.useSecureCookies).toBe(true);
	});

	it("disables CSRF and origin checks for local and test envs", () => {
		const localConfig = buildResolvedAuthConfig(
			buildEnv({ ENVIRONMENT: "local" }),
		);
		const testConfig = buildResolvedAuthConfig(
			buildEnv({ ENVIRONMENT: "test" }),
		);

		expect(localConfig.options.advanced?.disableCSRFCheck).toBe(true);
		expect(localConfig.options.advanced?.disableOriginCheck).toBe(true);
		expect(testConfig.options.advanced?.disableCSRFCheck).toBe(true);
		expect(testConfig.options.advanced?.disableOriginCheck).toBe(true);
	});

	it("enables CSRF and origin checks for production", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "production",
				BETTER_AUTH_URL: "https://auth-core.boletrics.com",
			}),
		);

		expect(config.options.advanced?.disableCSRFCheck).toBe(false);
		expect(config.options.advanced?.disableOriginCheck).toBe(false);
	});

	it("uses preview-specific rate limits", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "preview",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		expect(config.options.rateLimit).toEqual({
			window: 10,
			max: 120,
			enabled: true,
		});
	});

	it("uses production-specific session settings", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "production",
				BETTER_AUTH_URL: "https://auth-core.boletrics.com",
			}),
		);

		// Production has 7 day session expiry (60 * 60 * 24 * 7)
		expect(config.options.session?.expiresIn).toBe(604800);
	});

	it("uses longer session settings for non-production", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		// Non-production has 14 day session expiry (60 * 60 * 24 * 14)
		expect(config.options.session?.expiresIn).toBe(1209600);
	});

	it("returns proper cache key", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "dev",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		expect(config.cacheKey).toBe("boletrics-dev");
	});

	it("uses QA-specific settings", () => {
		const config = buildResolvedAuthConfig(
			buildEnv({
				ENVIRONMENT: "qa",
				BETTER_AUTH_URL: "https://auth-core.boletrics.workers.dev",
			}),
		);

		expect(config.options.rateLimit).toEqual({
			window: 10,
			max: 80,
			enabled: true,
		});
		expect(config.cacheKey).toBe("boletrics-qa");
	});
});
