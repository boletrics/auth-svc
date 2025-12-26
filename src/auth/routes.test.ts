import { describe, expect, it } from "vitest";

import { isBetterAuthRedirectError, isJwksDecryptError } from "./routes";

describe("isBetterAuthRedirectError", () => {
	it("returns false for null/undefined", () => {
		expect(isBetterAuthRedirectError(null)).toBe(false);
		expect(isBetterAuthRedirectError(undefined)).toBe(false);
	});

	it("returns false for non-object values", () => {
		expect(isBetterAuthRedirectError("error")).toBe(false);
		expect(isBetterAuthRedirectError(123)).toBe(false);
		expect(isBetterAuthRedirectError(true)).toBe(false);
	});

	it("returns false for plain objects without APIError name", () => {
		expect(isBetterAuthRedirectError({ statusCode: 302 })).toBe(false);
		expect(
			isBetterAuthRedirectError({
				statusCode: 302,
				headers: new Headers(),
			}),
		).toBe(false);
	});

	it("returns false for non-redirect status codes (< 300)", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 200,
				headers: new Headers(),
			}),
		).toBe(false);
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 299,
				headers: new Headers(),
			}),
		).toBe(false);
	});

	it("returns false for error status codes (>= 400)", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 400,
				headers: new Headers(),
			}),
		).toBe(false);
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 500,
				headers: new Headers(),
			}),
		).toBe(false);
	});

	it("returns false when headers is missing", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 302,
			}),
		).toBe(false);
	});

	it("returns true for valid redirect errors (300-399 with headers)", () => {
		const redirectError = {
			name: "APIError",
			statusCode: 302,
			headers: new Headers({ Location: "/callback" }),
		};
		expect(isBetterAuthRedirectError(redirectError)).toBe(true);
	});

	it("returns true for 301 redirect", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 301,
				headers: new Headers(),
			}),
		).toBe(true);
	});

	it("returns true for 307 redirect", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 307,
				headers: new Headers(),
			}),
		).toBe(true);
	});

	it("returns true for 308 redirect", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 308,
				headers: new Headers(),
			}),
		).toBe(true);
	});

	it("returns true for boundary status code 300", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 300,
				headers: new Headers(),
			}),
		).toBe(true);
	});

	it("returns true for boundary status code 399", () => {
		expect(
			isBetterAuthRedirectError({
				name: "APIError",
				statusCode: 399,
				headers: new Headers(),
			}),
		).toBe(true);
	});
});

describe("isJwksDecryptError", () => {
	it("returns false for null/undefined/empty values", () => {
		expect(isJwksDecryptError(null)).toBe(false);
		expect(isJwksDecryptError(undefined)).toBe(false);
		expect(isJwksDecryptError("")).toBe(false);
	});

	it("returns false for unrelated errors", () => {
		expect(isJwksDecryptError(new Error("Something went wrong"))).toBe(false);
		expect(isJwksDecryptError("random error")).toBe(false);
		expect(isJwksDecryptError({ message: "unrelated" })).toBe(false);
	});

	it('returns true for "Failed to decrypt private key" message', () => {
		expect(isJwksDecryptError(new Error("Failed to decrypt private key"))).toBe(
			true,
		);
		expect(
			isJwksDecryptError(
				new Error("JWKS error: Failed to decrypt private key"),
			),
		).toBe(true);
	});

	it("returns true for BetterAuthError with decrypt private key", () => {
		expect(
			isJwksDecryptError(new Error("BetterAuthError: decrypt private key")),
		).toBe(true);
		expect(
			isJwksDecryptError(
				new Error("BetterAuthError: Failed to DECRYPT PRIVATE KEY"),
			),
		).toBe(true);
	});

	it("returns true for string messages", () => {
		expect(isJwksDecryptError("Failed to decrypt private key")).toBe(true);
		expect(
			isJwksDecryptError(
				"BetterAuthError: could not decrypt private key from DB",
			),
		).toBe(true);
	});

	it("returns false for partial matches without both conditions", () => {
		// Has "BetterAuthError" but not "decrypt private key"
		expect(isJwksDecryptError("BetterAuthError: invalid token")).toBe(false);
		// Has "decrypt" but not "private key"
		expect(isJwksDecryptError("Failed to decrypt session")).toBe(false);
	});
});
