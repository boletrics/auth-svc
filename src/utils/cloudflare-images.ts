/**
 * Cloudflare Images API client for image uploads.
 *
 * Uses direct creator upload flow:
 * 1. Backend requests a one-time upload URL from Cloudflare
 * 2. Frontend uploads directly to that URL
 * 3. Cloudflare returns the image ID
 * 4. Image is served via Cloudflare's CDN
 */

export interface CloudflareImagesConfig {
	accountId: string;
	apiToken: string;
	imagesHash: string;
}

export interface DirectUploadResponse {
	uploadURL: string;
	id: string;
}

export interface ImageUploadResult {
	id: string;
	filename: string;
	uploaded: string;
	requireSignedURLs: boolean;
	variants: string[];
}

/**
 * Cloudflare Images API error
 */
export class CloudflareImagesError extends Error {
	constructor(
		message: string,
		public readonly code?: number,
		public readonly errors?: Array<{ code: number; message: string }>,
	) {
		super(message);
		this.name = "CloudflareImagesError";
	}
}

/**
 * Request a direct upload URL from Cloudflare Images.
 * The returned URL can be used by the client to upload an image directly.
 *
 * @param config - Cloudflare Images configuration
 * @param metadata - Optional metadata to attach to the image
 * @returns Upload URL and image ID
 */
export async function getDirectUploadUrl(
	config: CloudflareImagesConfig,
	metadata?: Record<string, string>,
): Promise<DirectUploadResponse> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v2/direct_upload`;

	const formData = new FormData();

	// Add metadata if provided
	if (metadata) {
		formData.append("metadata", JSON.stringify(metadata));
	}

	// Request signed URLs to be disabled (images are public)
	formData.append("requireSignedURLs", "false");

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
		},
		body: formData,
	});

	const data = (await response.json()) as {
		success: boolean;
		result?: { uploadURL: string; id: string };
		errors?: Array<{ code: number; message: string }>;
	};

	if (!response.ok || !data.success || !data.result) {
		throw new CloudflareImagesError(
			data.errors?.[0]?.message ?? "Failed to get upload URL",
			response.status,
			data.errors,
		);
	}

	return {
		uploadURL: data.result.uploadURL,
		id: data.result.id,
	};
}

/**
 * Delete an image from Cloudflare Images.
 *
 * @param config - Cloudflare Images configuration
 * @param imageId - The ID of the image to delete
 */
export async function deleteImage(
	config: CloudflareImagesConfig,
	imageId: string,
): Promise<void> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/${imageId}`;

	const response = await fetch(url, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
		},
	});

	if (!response.ok) {
		const data = (await response.json()) as {
			errors?: Array<{ code: number; message: string }>;
		};
		throw new CloudflareImagesError(
			data.errors?.[0]?.message ?? "Failed to delete image",
			response.status,
			data.errors,
		);
	}
}

/**
 * Get the delivery URL for an image.
 *
 * @param imagesHash - The Cloudflare Images account hash
 * @param imageId - The image ID
 * @param variant - The variant name (e.g., "public", "thumbnail", "avatar")
 * @returns The full delivery URL
 */
export function getImageDeliveryUrl(
	imagesHash: string,
	imageId: string,
	variant: string = "public",
): string {
	return `https://imagedelivery.net/${imagesHash}/${imageId}/${variant}`;
}

/**
 * Extract image ID from a Cloudflare Images delivery URL.
 *
 * @param url - The delivery URL
 * @returns The image ID or null if not a valid CF Images URL
 */
export function extractImageId(url: string): string | null {
	const match = url.match(/imagedelivery\.net\/[^/]+\/([^/]+)/);
	return match?.[1] ?? null;
}

