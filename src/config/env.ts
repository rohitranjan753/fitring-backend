import 'dotenv/config';

// Read .env and use fallback value if not provided
// using local postgres here
export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/fitring',
  dbSsl: process.env.DB_SSL === 'true',
  dbSynchronize: process.env.DB_SYNCHRONIZE !== 'false', // default true, for local dev convenience
  dbLogging: process.env.DB_LOGGING === 'true',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
};
