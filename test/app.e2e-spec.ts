/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './../src/modules/health/health.module';

describe('Health API (e2e)', () => {
  let app: INestApplication<App>;

  type HealthResponse = {
    status: string;
    timestamp: string;
  };

  type ReadinessResponse = {
    status: string;
    details: {
      database: {
        status: string;
      };
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health should return status and timestamp', async () => {
    const response: Response = await request(app.getHttpServer()).get('/api/health').expect(200);

    const body = response.body as HealthResponse;

    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
      }),
    );

    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('GET /api/health/live should return liveness status', () => {
    return request(app.getHttpServer()).get('/api/health/live').expect(200).expect({ status: 'ok' });
  });

  it('GET /api/health/ready should return readiness details', async () => {
    const response: Response = await request(app.getHttpServer()).get('/api/health/ready').expect(200);

    const body = response.body as ReadinessResponse;

    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        details: expect.objectContaining({
          database: expect.objectContaining({ status: 'up' }),
        }),
      }),
    );
  });
});
