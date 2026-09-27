export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ImageLab API",
    version: "1.0.0",
    summary: "Upload, manage, and deliver images and PDFs from your own server.",
    description:
      "Authenticate dashboard sessions with a short-lived JWT. Authenticate server-side integrations with a secret API key (`il_sk_test_` locally, `il_sk_live_` in production). Never put a secret key in a browser or mobile app. Public delivery URLs do not require a key. Storage uses the same plan credits as the dashboard: 1 credit = 1 MiB stored. Views and transforms do not consume credits.",
  },
  servers: [
    { url: "https://api.imagelab.site", description: "Production" },
    { url: "http://localhost:5050", description: "Local development" },
  ],
  tags: [
    { name: "Assets", description: "Upload, list, update, and delete images and PDFs." },
    { name: "API keys", description: "Create and revoke secret keys. Dashboard JWT only." },
    { name: "Delivery", description: "Unauthenticated public file URLs." },
  ],
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Health check",
        security: [],
        responses: {
          "200": { description: "API is running" },
        },
      },
    },
    "/api/v1/assets": {
      get: {
        tags: ["Assets"],
        summary: "List assets",
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string", maxLength: 120 },
            description: "Optional search against filename, publicId, format, or MIME type.",
          },
        ],
        responses: {
          "200": { description: "Assets and current credit usage." },
          "401": { description: "Missing or invalid credentials." },
          "403": { description: "Key is missing asset:read." },
        },
      },
      post: {
        tags: ["Assets"],
        summary: "Upload an image or PDF",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary", description: "Image (jpeg, png, webp, gif, avif) or PDF. Default max 10 MB." },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Uploaded. Returns PublicAsset including publicId and url." },
          "400": { description: "Missing or unsupported file." },
          "401": { description: "Missing or invalid credentials." },
          "402": { description: "Credits finished. Upgrade or delete files." },
          "403": { description: "Key is missing asset:upload." },
          "413": { description: "File is larger than MAX_UPLOAD_BYTES." },
        },
      },
    },
    "/api/v1/assets/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Mongo ObjectId or publicId from the delivery URL.",
        },
      ],
      get: {
        tags: ["Assets"],
        summary: "Get one asset",
        responses: {
          "200": { description: "PublicAsset" },
          "404": { description: "Not found or not owned." },
        },
      },
      patch: {
        tags: ["Assets"],
        summary: "Rename an asset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["originalName"],
                properties: { originalName: { type: "string", minLength: 1, maxLength: 180 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated PublicAsset" },
        },
      },
      delete: {
        tags: ["Assets"],
        summary: "Delete an asset",
        description: "Soft-deletes the record and frees credits. Public URLs stop resolving.",
        responses: {
          "200": { description: "Deleted" },
        },
      },
    },
    "/api/v1/assets/{id}/replace": {
      post: {
        tags: ["Assets"],
        summary: "Replace file bytes",
        description: "Keeps the same publicId and URL. Credits are adjusted by the size difference.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Replaced PublicAsset" },
          "402": { description: "Replacement does not fit remaining credits." },
        },
      },
    },
    "/api/v1/assets/bulk-delete": {
      post: {
        tags: ["Assets"],
        summary: "Delete up to 50 assets",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ids"],
                properties: {
                  ids: {
                    type: "array",
                    minItems: 1,
                    maxItems: 50,
                    items: { type: "string", description: "ObjectId or publicId" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Deleted" },
        },
      },
    },
    "/api/v1/api-keys": {
      get: {
        tags: ["API keys"],
        summary: "List API keys",
        description: "Dashboard JWT only. List never includes the full secret; use reveal to fetch it.",
        security: [{ dashboardJwt: [] }],
        responses: { "200": { description: "Key metadata" } },
      },
      post: {
        tags: ["API keys"],
        summary: "Create an API key",
        security: [{ dashboardJwt: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", maxLength: 80 },
                  scopes: {
                    type: "array",
                    items: { type: "string", enum: ["asset:upload", "asset:read", "asset:update", "asset:delete"] },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Metadata plus secret. The secret can also be revealed later from the dashboard." },
        },
      },
    },
    "/api/v1/api-keys/{id}/reveal": {
      post: {
        tags: ["API keys"],
        summary: "Reveal the full secret",
        description: "Dashboard JWT only. Returns the same secret that was created for this key.",
        security: [{ dashboardJwt: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "{ secret }" },
          "409": { description: "Key was created before secrets were stored encrypted." },
        },
      },
    },
    "/api/v1/api-keys/{id}": {
      delete: {
        tags: ["API keys"],
        summary: "Revoke an API key",
        security: [{ dashboardJwt: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Revoked" } },
      },
    },
    "/image/upload/{publicId}": {
      get: {
        tags: ["Delivery"],
        summary: "Original file",
        security: [],
        parameters: [{ name: "publicId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Binary image or PDF" } },
      },
    },
    "/image/upload/{transforms}/{publicId}": {
      get: {
        tags: ["Delivery"],
        summary: "Transformed image",
        description:
          "Cloudinary-style tokens: w_ (width), h_ (height), c_ (fill|fit|limit|scale|thumb), q_ (1-100 or auto), f_ (jpeg|png|webp|avif|auto). PDFs cannot be transformed.",
        security: [],
        parameters: [
          { name: "transforms", in: "path", required: true, schema: { type: "string", example: "w_800,f_auto,q_auto" } },
          { name: "publicId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Transformed image bytes" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API secret (`il_sk_test_...` / `il_sk_live_...`) or dashboard access JWT.",
      },
      dashboardJwt: {
        type: "http",
        scheme: "bearer",
        description: "Short-lived dashboard access token. API keys are rejected on these routes.",
      },
    },
    schemas: {
      Envelope: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: { description: "Present on success when the route returns a body." },
        },
      },
      PublicAsset: {
        type: "object",
        properties: {
          id: { type: "string" },
          publicId: { type: "string" },
          bytes: { type: "integer" },
          width: { type: "integer" },
          height: { type: "integer" },
          format: { type: "string" },
          mime: { type: "string" },
          originalName: { type: "string" },
          url: { type: "string", format: "uri" },
          transformUrl: { type: "string", format: "uri" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
} as const;
