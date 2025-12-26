import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../types/bindings";
import {
	getDirectUploadUrl,
	getImageDeliveryUrl,
	deleteImage,
	CloudflareImagesError,
	type CloudflareImagesConfig,
} from "../utils/cloudflare-images";

// Request schema for upload URL
const getUploadUrlRequestSchema = z.object({
	// Optional user ID to associate with the avatar
	userId: z.string().optional(),
});

// Create router
export const avatarsRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Get Cloudflare Images config from environment
 */
function getImagesConfig(env: Bindings): CloudflareImagesConfig {
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = env.CLOUDFLARE_IMAGES_TOKEN;
	const imagesHash = env.CLOUDFLARE_IMAGES_HASH;

	if (!accountId || !apiToken || !imagesHash) {
		throw new Error(
			"Cloudflare Images not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_IMAGES_TOKEN, and CLOUDFLARE_IMAGES_HASH.",
		);
	}

	return { accountId, apiToken, imagesHash };
}

/**
 * POST /avatars/upload-url
 * Get a direct upload URL for uploading an avatar to Cloudflare Images.
 * The client can then upload directly to this URL.
 */
avatarsRouter.post("/upload-url", async (c) => {
	try {
		const body = await c.req.json().catch(() => ({}));
		const parsed = getUploadUrlRequestSchema.safeParse(body);

		// Metadata to attach to the image
		const metadata: Record<string, string> = {
			service: "auth-svc",
			context: "avatar",
			environment: c.env.ENVIRONMENT ?? "unknown",
		};

		if (parsed.success && parsed.data.userId) {
			metadata.userId = parsed.data.userId;
		}

		const config = getImagesConfig(c.env);
		const result = await getDirectUploadUrl(config, metadata);

		const response = {
			uploadURL: result.uploadURL,
			imageId: result.id,
			// Avatar variant for optimized avatar delivery
			deliveryUrl: getImageDeliveryUrl(config.imagesHash, result.id, "avatar"),
		};

		return c.json({
			success: true,
			result: response,
		});
	} catch (error) {
		if (error instanceof CloudflareImagesError) {
			return c.json(
				{
					success: false,
					errors: [{ code: error.code ?? 500, message: error.message }],
				},
				error.code === 401 ? 401 : 500,
			);
		}

		console.error("Failed to get upload URL:", error);
		return c.json(
			{
				success: false,
				errors: [
					{
						code: 500,
						message:
							error instanceof Error
								? error.message
								: "Failed to get upload URL",
					},
				],
			},
			500,
		);
	}
});

/**
 * DELETE /avatars/:imageId
 * Delete an avatar from Cloudflare Images.
 */
avatarsRouter.delete("/:imageId", async (c) => {
	try {
		const imageId = c.req.param("imageId");

		if (!imageId) {
			return c.json(
				{
					success: false,
					errors: [{ code: 400, message: "Image ID is required" }],
				},
				400,
			);
		}

		const config = getImagesConfig(c.env);
		await deleteImage(config, imageId);

		return c.json({
			success: true,
			result: { deleted: true },
		});
	} catch (error) {
		if (error instanceof CloudflareImagesError) {
			return c.json(
				{
					success: false,
					errors: [{ code: error.code ?? 500, message: error.message }],
				},
				error.code === 404 ? 404 : 500,
			);
		}

		console.error("Failed to delete avatar:", error);
		return c.json(
			{
				success: false,
				errors: [
					{
						code: 500,
						message:
							error instanceof Error
								? error.message
								: "Failed to delete avatar",
					},
				],
			},
			500,
		);
	}
});

/**
 * GET /avatars/delivery-url/:imageId
 * Get the delivery URL for an avatar.
 */
avatarsRouter.get("/delivery-url/:imageId", async (c) => {
	const imageId = c.req.param("imageId");
	const variant = c.req.query("variant") ?? "avatar";

	if (!imageId) {
		return c.json(
			{
				success: false,
				errors: [{ code: 400, message: "Image ID is required" }],
			},
			400,
		);
	}

	const config = getImagesConfig(c.env);
	const deliveryUrl = getImageDeliveryUrl(config.imagesHash, imageId, variant);

	return c.json({
		success: true,
		result: { deliveryUrl },
	});
});

