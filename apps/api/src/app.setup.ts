import type { INestApplication } from '@nestjs/common';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

/** Origins from CORS_ORIGINS (comma-separated). Defaults to the local web app. */
export function corsOrigins(raw: string | undefined = process.env.CORS_ORIGINS): string[] {
  const configured = raw?.trim() ? raw : DEFAULT_CORS_ORIGIN;
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}

/** Shared by the local server (main.ts), the Vercel handler (serverless.ts) and the tests. */
export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
}
