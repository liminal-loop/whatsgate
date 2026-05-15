import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { HookManager } from '../../../core/hooks';
import { Webhook } from '../../webhook/entities/webhook.entity';
import { WebhookJobData } from '../../webhook/webhook.service';
import { WebhookProcessor } from './webhook.processor';

type MockJob = {
  id: string;
  attemptsMade: number;
  data: WebhookJobData;
};

function createMockJob(overrides: Partial<MockJob> = {}): MockJob {
  return {
    id: 'job-1',
    attemptsMade: 0,
    data: {
      webhookId: 'wh-1',
      url: 'https://example.com/webhook',
      event: 'message.received',
      payload: {
        event: 'message.received',
        timestamp: new Date().toISOString(),
        sessionId: 'sess-1',
        idempotencyKey: 'idem-1',
        deliveryId: 'deliv-1',
        data: { from: '123' },
      },
      signature: '',
      headers: { 'Content-Type': 'application/json' },
      attempt: 1,
      maxRetries: 3,
    },
    ...overrides,
  };
}

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let webhookRepository: jest.Mocked<Partial<Repository<Webhook>>>;
  let hookManager: jest.Mocked<Partial<HookManager>>;
  const mockFetch = jest.fn();

  beforeEach(() => {
    webhookRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    hookManager = {
      execute: jest.fn().mockResolvedValue({ continue: true, data: {} }),
    };

    global.fetch = mockFetch as typeof global.fetch;
    processor = new WebhookProcessor(webhookRepository as Repository<Webhook>, hookManager as HookManager);
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('should return success result and execute delivered hook on successful delivery', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    const job = createMockJob();
    const typedJob = job as unknown as Job<WebhookJobData>;

    const result: Awaited<ReturnType<WebhookProcessor['process']>> = await processor.process(typedJob);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    const updateCalls = (webhookRepository.update as jest.Mock).mock.calls as Array<
      [
        string,
        {
          lastTriggeredAt: Date;
        },
      ]
    >;
    const firstUpdate = updateCalls[0];
    expect(firstUpdate?.[0]).toBe('wh-1');
    expect(firstUpdate?.[1].lastTriggeredAt).toBeInstanceOf(Date);
    expect(hookManager.execute).toHaveBeenCalledWith(
      'webhook:delivered',
      expect.objectContaining({ sessionId: 'sess-1', event: 'message.received', webhookId: 'wh-1' }),
      expect.objectContaining({ sessionId: 'sess-1', source: 'WebhookProcessor' }),
    );
  });

  it('should throw and skip error hook on non-final failed attempt', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    const job = createMockJob({ attemptsMade: 0 });
    const typedJob = job as unknown as Job<WebhookJobData>;

    await expect(processor.process(typedJob)).rejects.toThrow('HTTP 500: Internal Server Error');
    expect(hookManager.execute).not.toHaveBeenCalledWith(
      'webhook:error',
      expect.anything(),
      expect.objectContaining({ source: 'WebhookProcessor' }),
    );
  });

  it('should throw and execute error hook on final failed attempt', async () => {
    mockFetch.mockRejectedValue(new Error('network timeout'));
    const job = createMockJob({ attemptsMade: 2 });
    const typedJob = job as unknown as Job<WebhookJobData>;

    await expect(processor.process(typedJob)).rejects.toThrow('network timeout');
    expect(hookManager.execute).toHaveBeenCalledWith(
      'webhook:error',
      expect.objectContaining({
        sessionId: 'sess-1',
        event: 'message.received',
        webhookId: 'wh-1',
        error: 'network timeout',
        attempt: 3,
      }),
      expect.objectContaining({ sessionId: 'sess-1', source: 'WebhookProcessor' }),
    );
  });
});
