import { app } from './app';
import { AppDataSource } from './config/data-source';
import { env } from './config/env';

async function bootstrap() {
  await AppDataSource.initialize();
  app.listen(env.port, () => {
    console.log(`FitRing backend listening on port ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
