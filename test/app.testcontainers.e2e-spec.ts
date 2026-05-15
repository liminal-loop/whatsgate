/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';

interface PostgresContainerInstance {
  getHost(): string;
  getPort(): number;
  getDatabase(): string;
  getUsername(): string;
  getPassword(): string;
  stop(): Promise<void>;
}

const runTestcontainersE2E = process.env.RUN_TESTCONTAINERS_E2E === 'true';
const describeIf = runTestcontainersE2E ? describe : describe.skip;

describeIf('App (e2e, testcontainers)', () => {
  let app: INestApplication<App>;
  let container: PostgresContainerInstance | null = null;

  beforeAll(async () => {
    const moduleName = 'testcontainers';
    const { PostgreSqlContainer } = (await import(moduleName)) as {
      PostgreSqlContainer: new (image?: string) => {
        start(): Promise<PostgresContainerInstance>;
      };
    };

    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    process.env.DATABASE_HOST = container.getHost();
    process.env.DATABASE_PORT = String(container.getPort());
    process.env.DATABASE_NAME = container.getDatabase();
    process.env.DATABASE_USERNAME = container.getUsername();
    process.env.DATABASE_PASSWORD = container.getPassword();
    process.env.DATABASE_SYNCHRONIZE = 'true';
    process.env.QUEUE_ENABLED = 'false';
    process.env.REDIS_ENABLED = 'false';

    const { AppModule } = (await import('./../src/app.module')) as {
      AppModule: unknown;
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule as Parameters<typeof Test.createTestingModule>[0]['imports'][number]],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (container) {
      await container.stop();
    }
  });

  it('should serve health endpoint with real infrastructure boot', async () => {
    const response: Response = await request(app.getHttpServer()).get('/api/health').expect(200);

    const body = response.body as { status: string; timestamp: string };

    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
      }),
    );
  });
});
