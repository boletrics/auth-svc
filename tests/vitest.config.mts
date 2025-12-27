import path from "node:path";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const migrationsPath = path.join(__dirname, "..", "migrations");
const migrations = await readD1Migrations(migrationsPath);

export default defineWorkersConfig({
	esbuild: {
		target: "esnext",
	},
	test: {
		// Better Auth throws APIError as unhandled rejections for certain redirect flows
		// (e.g., invalid email verification tokens). These are caught by our error handler
		// and returned as proper responses, but Better Auth still throws internally.
		dangerouslyIgnoreUnhandledErrors: true,
		coverage: {
			provider: "istanbul",
			reporter: ["text", "lcov"],
			all: true,
			include: ["src/**/*.ts"],
			exclude: [
				"**/*.d.ts",
				"**/node_modules/**",
				"**/tests/**",
				"**/dist/**",
				"**/coverage/**",
				"**/endpoints/**/openapi.ts", // OpenAPI schema definitions don't need coverage
				"**/utils/mandrill.ts", // External email service - tested via integration
				"**/utils/turnstile.ts", // External captcha service - tested via integration
				"**/utils/kv-storage.ts", // KV storage - tested via integration
				"**/utils/cloudflare-images.ts", // External Cloudflare Images service - tested via integration
				"**/endpoints/avatars.ts", // Avatar endpoints rely on external Cloudflare Images service
				"**/types.ts", // Type definitions only
				"**/types/**", // Type definitions only
			],
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 85,
				statements: 85,
			},
		},
		setupFiles: ["./tests/apply-migrations.ts"],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: {
					configPath: "../wrangler.jsonc",
				},
				miniflare: {
					compatibilityFlags: ["experimental", "nodejs_compat"],
					bindings: {
						MIGRATIONS: migrations,
					},
				},
			},
		},
	},
});
