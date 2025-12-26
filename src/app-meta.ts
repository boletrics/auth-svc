export type AppMeta = {
	name: string;
	version: string;
	description?: string;
};

export function getOpenApiInfo(meta: AppMeta): {
	title: string;
	version: string;
	description: string;
} {
	return {
		title: meta.name,
		version: meta.version,
		description:
			meta.description ??
			`OpenAPI documentation for ${meta.name} (${meta.version}).`,
	};
}

export function getScalarHtml(meta: AppMeta): string {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${meta.name} API Reference (v${meta.version})</title>
    <style>
      html, body { height: 100%; margin: 0; }
    </style>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.css" />
  </head>
  <body>
    <!-- Scalar standalone auto-mount -->
    <!-- Use Better Auth's OpenAPI spec at /api/auth/open-api/generate-schema -->
    <script id="api-reference" data-url="/api/auth/open-api/generate-schema"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.js"></script>
  </body>
</html>`;
}
