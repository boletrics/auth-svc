import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	CloudflareImagesError,
	getDirectUploadUrl,
	deleteImage,
	getImageDeliveryUrl,
	extractImageId,
	type CloudflareImagesConfig,
} from "./cloudflare-images";

describe("cloudflare-images", () => {
	const mockConfig: CloudflareImagesConfig = {
		accountId: "test-account-id",
		apiToken: "test-api-token",
		imagesHash: "test-images-hash",
	};

	describe("CloudflareImagesError", () => {
		it("creates error with message only", () => {
			const error = new CloudflareImagesError("Test error");
			expect(error.message).toBe("Test error");
			expect(error.name).toBe("CloudflareImagesError");
			expect(error.code).toBeUndefined();
			expect(error.errors).toBeUndefined();
		});

		it("creates error with code", () => {
			const error = new CloudflareImagesError("Unauthorized", 401);
			expect(error.message).toBe("Unauthorized");
			expect(error.code).toBe(401);
		});

		it("creates error with errors array", () => {
			const errors = [
				{ code: 1001, message: "Invalid token" },
				{ code: 1002, message: "Missing header" },
			];
			const error = new CloudflareImagesError("Multiple errors", 400, errors);
			expect(error.errors).toEqual(errors);
		});
	});

	describe("getImageDeliveryUrl", () => {
		it("constructs correct URL with default variant", () => {
			const url = getImageDeliveryUrl("hash123", "img456");
			expect(url).toBe("https://imagedelivery.net/hash123/img456/public");
		});

		it("constructs correct URL with custom variant", () => {
			const url = getImageDeliveryUrl("hash123", "img456", "avatar");
			expect(url).toBe("https://imagedelivery.net/hash123/img456/avatar");
		});

		it("constructs correct URL with thumbnail variant", () => {
			const url = getImageDeliveryUrl("myhash", "myimage", "thumbnail");
			expect(url).toBe("https://imagedelivery.net/myhash/myimage/thumbnail");
		});
	});

	describe("extractImageId", () => {
		it("extracts image ID from valid delivery URL", () => {
			const url = "https://imagedelivery.net/abcdef123/img-xyz-789/public";
			expect(extractImageId(url)).toBe("img-xyz-789");
		});

		it("extracts image ID from URL with different variant", () => {
			const url = "https://imagedelivery.net/hash/imageid/avatar";
			expect(extractImageId(url)).toBe("imageid");
		});

		it("returns null for invalid URL", () => {
			expect(extractImageId("https://example.com/image.png")).toBeNull();
		});

		it("returns null for empty string", () => {
			expect(extractImageId("")).toBeNull();
		});

		it("returns null for non-imagedelivery URL", () => {
			expect(
				extractImageId("https://cdn.example.com/hash/id/variant"),
			).toBeNull();
		});
	});

	describe("getDirectUploadUrl", () => {
		const originalFetch = globalThis.fetch;

		beforeEach(() => {
			vi.restoreAllMocks();
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it("returns upload URL and ID on success", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					result: {
						uploadURL: "https://upload.imagedelivery.net/upload/abc",
						id: "img-new-123",
					},
				}),
			});

			const result = await getDirectUploadUrl(mockConfig);

			expect(result).toEqual({
				uploadURL: "https://upload.imagedelivery.net/upload/abc",
				id: "img-new-123",
			});

			expect(fetch).toHaveBeenCalledWith(
				`https://api.cloudflare.com/client/v4/accounts/${mockConfig.accountId}/images/v2/direct_upload`,
				expect.objectContaining({
					method: "POST",
					headers: {
						Authorization: `Bearer ${mockConfig.apiToken}`,
					},
				}),
			);
		});

		it("includes metadata in request when provided", async () => {
			let capturedBody: FormData | null = null;
			globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
				capturedBody = options.body as FormData;
				return {
					ok: true,
					json: async () => ({
						success: true,
						result: { uploadURL: "https://test.com", id: "123" },
					}),
				};
			});

			await getDirectUploadUrl(mockConfig, {
				userId: "user-123",
				context: "avatar",
			});

			expect(capturedBody).not.toBeNull();
			expect(capturedBody!.get("metadata")).toBe(
				JSON.stringify({ userId: "user-123", context: "avatar" }),
			);
		});

		it("throws CloudflareImagesError on API failure", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: async () => ({
					success: false,
					errors: [{ code: 10000, message: "Authentication error" }],
				}),
			});

			await expect(getDirectUploadUrl(mockConfig)).rejects.toThrow(
				CloudflareImagesError,
			);

			try {
				await getDirectUploadUrl(mockConfig);
			} catch (error) {
				expect(error).toBeInstanceOf(CloudflareImagesError);
				expect((error as CloudflareImagesError).code).toBe(401);
				expect((error as CloudflareImagesError).message).toBe(
					"Authentication error",
				);
			}
		});

		it("throws error with default message when no errors in response", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({
					success: false,
				}),
			});

			await expect(getDirectUploadUrl(mockConfig)).rejects.toThrow(
				"Failed to get upload URL",
			);
		});

		it("throws error when success is false but response is ok", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					success: false,
					errors: [{ code: 1000, message: "Internal error" }],
				}),
			});

			await expect(getDirectUploadUrl(mockConfig)).rejects.toThrow(
				CloudflareImagesError,
			);
		});
	});

	describe("deleteImage", () => {
		const originalFetch = globalThis.fetch;

		beforeEach(() => {
			vi.restoreAllMocks();
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it("successfully deletes an image", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
			});

			await expect(
				deleteImage(mockConfig, "img-to-delete"),
			).resolves.toBeUndefined();

			expect(fetch).toHaveBeenCalledWith(
				`https://api.cloudflare.com/client/v4/accounts/${mockConfig.accountId}/images/v1/img-to-delete`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${mockConfig.apiToken}`,
					},
				},
			);
		});

		it("throws CloudflareImagesError on 404", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				json: async () => ({
					errors: [{ code: 5404, message: "Image not found" }],
				}),
			});

			await expect(deleteImage(mockConfig, "nonexistent")).rejects.toThrow(
				CloudflareImagesError,
			);

			try {
				await deleteImage(mockConfig, "nonexistent");
			} catch (error) {
				expect(error).toBeInstanceOf(CloudflareImagesError);
				expect((error as CloudflareImagesError).code).toBe(404);
			}
		});

		it("throws error with default message when no errors in response", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({}),
			});

			await expect(deleteImage(mockConfig, "test")).rejects.toThrow(
				"Failed to delete image",
			);
		});

		it("throws CloudflareImagesError on 403", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 403,
				json: async () => ({
					errors: [{ code: 10000, message: "Forbidden" }],
				}),
			});

			try {
				await deleteImage(mockConfig, "test");
			} catch (error) {
				expect(error).toBeInstanceOf(CloudflareImagesError);
				expect((error as CloudflareImagesError).code).toBe(403);
			}
		});
	});
});
