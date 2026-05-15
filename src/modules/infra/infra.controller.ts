import { Controller, Get, Put, Post, Body, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Public, RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { EngineFactory } from '../../engine/engine.factory';
import { CacheService } from '../../common/cache/cache.service';
import { StorageService } from '../../common/storage/storage.service';
import { ShutdownService } from '../../common/services/shutdown.service';
import { createLogger } from '../../common/services/logger.service';
import * as fs from 'fs';
import * as path from 'path';

interface InfraStatus {
  database: { connected: boolean; type: string; host: string };
  redis: { enabled: boolean; connected: boolean; host: string; port: number };
  queue: {
    enabled: boolean;
    messages: { pending: number; completed: number; failed: number };
    webhooks: { pending: number; completed: number; failed: number };
  };
  storage: { type: 'local' | 's3'; path?: string; bucket?: string };
  engine: { type: string; headless: boolean; sessionDataPath: string; browserArgs: string };
}

interface SaveConfigDto {
  database?: {
    type: 'postgres';
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    database?: string;
    poolSize?: number;
    sslEnabled?: boolean;
  };
  redis?: {
    enabled?: boolean;
    host?: string;
    port?: string;
    password?: string;
  };
  queue?: {
    enabled?: boolean;
  };
  storage?: {
    type: 'local' | 's3';
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
    s3AccessKey?: string;
    s3SecretKey?: string;
    s3Endpoint?: string;
  };
  engine?: {
    headless?: boolean;
    sessionDataPath?: string;
    browserArgs?: string;
  };
}

// Database migration types for export/import
interface SessionRow {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  pushName: string | null;
  config: string | Record<string, unknown>;
  proxyUrl: string | null;
  proxyType: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebhookRow {
  id: string;
  sessionId: string;
  url: string;
  events: string | string[];
  secret: string | null;
  headers: string | Record<string, string>;
  active: boolean;
  retryCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  sessionId: string;
  waMessageId: string | null;
  messageId?: string;
  chatId: string;
  from: string;
  to: string;
  direction: string;
  type: string;
  body: string | null;
  content?: string | Record<string, unknown>;
  status: string;
  timestamp: number | null;
  metadata: string | Record<string, unknown>;
  createdAt: string;
}

interface MessageBatchRow {
  id: string;
  batch_id: string;
  batchId?: string;
  session_id: string;
  sessionId?: string;
  status: string;
  messages: string | unknown[];
  options: string | Record<string, unknown>;
  progress: string | Record<string, unknown>;
  results: string | unknown[];
  current_index: number;
  currentIndex?: number;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  started_at: string | null;
  startedAt?: string | null;
  completed_at: string | null;
  completedAt?: string | null;
}

interface MigrationTables {
  sessions: SessionRow[];
  webhooks: WebhookRow[];
  messages: MessageRow[];
  messageBatches: MessageBatchRow[];
}

@ApiTags('infrastructure')
@Controller('infra')
export class InfraController {
  private readonly logger = createLogger('InfraController');

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource('main')
    private readonly mainDataSource: DataSource,
    @InjectDataSource('data')
    private readonly dataDataSource: DataSource,
    private readonly engineFactory: EngineFactory,
    private readonly cacheService: CacheService,
    private readonly storageService: StorageService,
    private readonly shutdownService: ShutdownService,
  ) {}

  @Get('status')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get infrastructure status' })
  @ApiResponse({ status: 200, description: 'Infrastructure status' })
  async getStatus(): Promise<InfraStatus> {
    const mainDbConnected = this.mainDataSource.isInitialized;
    const dataDbConnected = this.dataDataSource.isInitialized;
    const dbConnected = mainDbConnected && dataDbConnected;
    const dbType = this.configService.get<string>('database.type', 'postgres');
    const dbHost = this.configService.get<string>('database.host', 'localhost');

    const redisHost = process.env.REDIS_HOST || this.configService.get<string>('redis.host', 'localhost');
    const redisPort = parseInt(process.env.REDIS_PORT || '', 10) || this.configService.get<number>('redis.port', 6379);
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    const queueEnabled = this.configService.get<boolean>('queue.enabled', false);

    const redisConnected = await this.cacheService.isAvailable();

    const storageType = this.configService.get<'local' | 's3'>('storage.type', 'local');
    const storagePath = this.configService.get<string>('storage.localPath', './data/media');

    const engineType = this.configService.get<string>('engine.type', 'whatsapp-web.js');
    const engineHeadless = this.configService.get<boolean>('engine.puppeteer.headless', true);
    const sessionDataPath = this.configService.get<string>('engine.sessionDataPath', './data/sessions');
    const browserArgs = this.configService
      .get<string[]>('engine.puppeteer.args', ['--no-sandbox', '--disable-setuid-sandbox'])
      .join(' ');

    return {
      database: { connected: dbConnected, type: dbType, host: dbHost },
      redis: { enabled: redisEnabled, connected: redisConnected, host: redisHost, port: redisPort },
      queue: {
        enabled: queueEnabled,
        messages: { pending: 0, completed: 0, failed: 0 },
        webhooks: { pending: 0, completed: 0, failed: 0 },
      },
      storage: { type: storageType, path: storagePath },
      engine: { type: engineType, headless: engineHeadless, sessionDataPath, browserArgs },
    };
  }

  @Get('engines')
  @ApiOperation({ summary: 'Get available WhatsApp engines' })
  @ApiResponse({ status: 200, description: 'List of available engines' })
  getEngines(): Array<{ id: string; name: string; enabled: boolean; features: string[] }> {
    return this.engineFactory.getAvailableEngines();
  }

  @Get('engines/current')
  @ApiOperation({ summary: 'Get current active engine' })
  @ApiResponse({ status: 200, description: 'Current engine info' })
  getCurrentEngine(): { engineType: string } {
    return { engineType: this.engineFactory.getCurrentEngine() };
  }

  @Put('config')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Save infrastructure configuration to .env file' })
  @ApiResponse({ status: 200, description: 'Configuration saved' })
  @ApiBody({ description: 'Configuration to save' })
  saveConfig(@Body() config: SaveConfigDto): { message: string; saved: boolean; envPath: string } {
    try {
      const envLines: string[] = [];
      const sanitizeEnvValue = (value: string): string => value.replace(/[\r\n]/g, '').trim();

      // Header
      envLines.push('# WhatsGate Configuration');
      envLines.push(`# Generated at ${new Date().toISOString()}`);
      envLines.push('');

      // Database
      if (config.database) {
        envLines.push('# Database');
        envLines.push(`DATABASE_HOST=${sanitizeEnvValue(config.database.host || 'localhost')}`);
        envLines.push(`DATABASE_PORT=${sanitizeEnvValue(config.database.port || '5432')}`);
        envLines.push(`DATABASE_USERNAME=${sanitizeEnvValue(config.database.username || 'whatsgate')}`);
        envLines.push(`DATABASE_PASSWORD=${sanitizeEnvValue(config.database.password || '')}`);
        envLines.push(`DATABASE_NAME=${sanitizeEnvValue(config.database.database || 'whatsgate')}`);
        envLines.push(`DATABASE_POOL_SIZE=${config.database.poolSize || 10}`);
        envLines.push(`DATABASE_SSL=${config.database.sslEnabled ? 'true' : 'false'}`);
        envLines.push('');
      }

      // Redis / Queue
      envLines.push('# Redis / Queue System');
      envLines.push(`REDIS_ENABLED=${config.redis?.enabled ? 'true' : 'false'}`);
      envLines.push(`QUEUE_ENABLED=${config.queue?.enabled ? 'true' : 'false'}`);
      if (config.redis?.enabled) {
        envLines.push(`REDIS_HOST=${sanitizeEnvValue(config.redis.host || 'localhost')}`);
        envLines.push(`REDIS_PORT=${sanitizeEnvValue(config.redis.port || '6379')}`);
        if (config.redis.password) {
          envLines.push(`REDIS_PASSWORD=${sanitizeEnvValue(config.redis.password)}`);
        }
      }
      envLines.push('');

      // Storage
      if (config.storage) {
        envLines.push('# Storage');
        envLines.push(`STORAGE_TYPE=${config.storage.type || 'local'}`);
        if (config.storage.type === 'local') {
          envLines.push(`STORAGE_LOCAL_PATH=${sanitizeEnvValue(config.storage.localPath || './data/media')}`);
        } else if (config.storage.type === 's3') {
          envLines.push(`S3_BUCKET=${sanitizeEnvValue(config.storage.s3Bucket || '')}`);
          envLines.push(`S3_REGION=${sanitizeEnvValue(config.storage.s3Region || 'ap-southeast-1')}`);
          envLines.push(`S3_ACCESS_KEY=${sanitizeEnvValue(config.storage.s3AccessKey || '')}`);
          envLines.push(`S3_SECRET_KEY=${sanitizeEnvValue(config.storage.s3SecretKey || '')}`);
          if (config.storage.s3Endpoint) {
            envLines.push(`S3_ENDPOINT=${sanitizeEnvValue(config.storage.s3Endpoint)}`);
          }
        }
        envLines.push('');
      }

      // Engine
      if (config.engine) {
        envLines.push('# WhatsApp Engine');
        envLines.push(`PUPPETEER_HEADLESS=${config.engine.headless !== false ? 'true' : 'false'}`);
        envLines.push(`SESSION_DATA_PATH=${sanitizeEnvValue(config.engine.sessionDataPath || './data/sessions')}`);
        envLines.push(
          `PUPPETEER_ARGS=${sanitizeEnvValue(config.engine.browserArgs || '--no-sandbox,--disable-setuid-sandbox')}`,
        );
        envLines.push('');
      }

      const envPath = path.resolve(process.cwd(), 'data', '.env.generated');
      fs.writeFileSync(envPath, envLines.join('\n'), 'utf8');
      this.logger.log('Configuration saved', { envPath });

      return {
        message: 'Configuration saved successfully. Server restart required to apply changes.',
        saved: true,
        envPath,
      };
    } catch (error) {
      this.logger.error('Failed to save configuration', undefined, { error: String(error) });
      return {
        message: 'Failed to save configuration. Check server logs.',
        saved: false,
        envPath: '',
      };
    }
  }

  @Post('restart')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Request graceful server restart' })
  @ApiResponse({ status: 200, description: 'Server will restart' })
  requestRestart(): { message: string; restarting: boolean; estimatedTime: number } {
    this.logger.log('Restart requested');

    // Schedule graceful shutdown after delay to allow response to be sent
    void this.shutdownService.shutdown(3000);

    return {
      message: 'Server is restarting. Please wait...',
      restarting: true,
      estimatedTime: 10,
    };
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Server is healthy' })
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('export-data')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Export all data from Data DB for migration' })
  @ApiResponse({ status: 200, description: 'Exported data as JSON' })
  async exportData(): Promise<{
    exportedAt: string;
    dataDbType: string;
    tables: MigrationTables;
    counts: { sessions: number; webhooks: number; messages: number; messageBatches: number };
  }> {
    const sessions = await this.dataDataSource.query<SessionRow[]>('SELECT * FROM sessions');
    const webhooks = await this.dataDataSource.query<WebhookRow[]>('SELECT * FROM webhooks');

    let messages: MessageRow[] = [];
    let messageBatches: MessageBatchRow[] = [];

    try {
      messages = await this.dataDataSource.query<MessageRow[]>(
        'SELECT id, "sessionId", "waMessageId", "chatId", "from", "to", direction, type, body, status, timestamp, metadata, "createdAt" FROM messages',
      );
    } catch (error) {
      this.logger.debug('Messages table not available for export', { error: String(error) });
    }

    try {
      messageBatches = await this.dataDataSource.query<MessageBatchRow[]>(
        'SELECT id, batch_id, session_id, status, messages, options, progress, results, current_index, created_at, updated_at, started_at, completed_at FROM message_batches',
      );
    } catch (error) {
      this.logger.debug('Message batches table not available for export', { error: String(error) });
    }

    return {
      exportedAt: new Date().toISOString(),
      dataDbType: this.configService.get<string>('database.type', 'postgres'),
      tables: { sessions, webhooks, messages, messageBatches },
      counts: {
        sessions: sessions.length,
        webhooks: webhooks.length,
        messages: messages.length,
        messageBatches: messageBatches.length,
      },
    };
  }

  @Post('import-data')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Import data to Data DB (replaces existing data)' })
  @ApiBody({
    description: 'Exported data from export-data endpoint',
    schema: {
      type: 'object',
      properties: {
        tables: {
          type: 'object',
          properties: {
            sessions: { type: 'array' },
            webhooks: { type: 'array' },
            messages: { type: 'array' },
            messageBatches: { type: 'array' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Data imported successfully' })
  async importData(
    @Body()
    data: {
      tables: Partial<MigrationTables>;
    },
  ): Promise<{
    imported: boolean;
    counts: { sessions: number; webhooks: number; messages: number; messageBatches: number };
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const queryRunner = this.dataDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('DELETE FROM webhooks');
      await queryRunner.query('DELETE FROM messages').catch(() => {});
      await queryRunner.query('DELETE FROM message_batches').catch(() => {});
      await queryRunner.query('DELETE FROM sessions');

      let sessionsCount = 0;
      if (data.tables.sessions?.length) {
        for (const session of data.tables.sessions) {
          try {
            await queryRunner.query(
              `INSERT INTO sessions (id, name, status, phone, "pushName", config, "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                session.id,
                session.name,
                session.status,
                session.phone,
                session.pushName,
                typeof session.config === 'string' ? session.config : JSON.stringify(session.config || {}),
                session.proxyUrl,
                session.proxyType,
                session.connectedAt,
                session.lastActiveAt,
                session.createdAt,
                session.updatedAt,
              ],
            );
            sessionsCount++;
          } catch (err) {
            warnings.push(
              `Failed to import session ${session.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
          }
        }
      }

      let webhooksCount = 0;
      if (data.tables.webhooks?.length) {
        for (const webhook of data.tables.webhooks) {
          try {
            await queryRunner.query(
              `INSERT INTO webhooks (id, "sessionId", url, events, secret, headers, active, "retryCount", "lastTriggeredAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                webhook.id,
                webhook.sessionId,
                webhook.url,
                typeof webhook.events === 'string' ? webhook.events : JSON.stringify(webhook.events || []),
                webhook.secret,
                typeof webhook.headers === 'string' ? webhook.headers : JSON.stringify(webhook.headers || {}),
                webhook.active,
                webhook.retryCount,
                webhook.lastTriggeredAt,
                webhook.createdAt,
                webhook.updatedAt,
              ],
            );
            webhooksCount++;
          } catch (err) {
            warnings.push(
              `Failed to import webhook ${webhook.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
          }
        }
      }

      let messagesCount = 0;
      if (data.tables.messages?.length) {
        for (const msg of data.tables.messages) {
          try {
            await queryRunner.query(
              `INSERT INTO messages (id, "sessionId", "waMessageId", "chatId", "from", "to", body, direction, type, timestamp, status, metadata, "createdAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7::text, $8, $9, $10, $11, $12, $13)`,
              [
                msg.id,
                msg.sessionId,
                msg.waMessageId ?? msg.messageId ?? null,
                msg.chatId,
                msg.from || '',
                msg.to || '',
                msg.body ?? (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || {})),
                msg.direction,
                msg.type,
                msg.timestamp,
                msg.status,
                typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata || {}),
                msg.createdAt,
              ],
            );
            messagesCount++;
          } catch (err) {
            warnings.push(
              `Failed to import message ${msg.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
          }
        }
      }

      let messageBatchesCount = 0;
      if (data.tables.messageBatches?.length) {
        for (const batch of data.tables.messageBatches) {
          try {
            await queryRunner.query(
              `INSERT INTO message_batches (id, batch_id, session_id, status, messages, options, progress, results, current_index, created_at, updated_at, started_at, completed_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                batch.id,
                batch.batch_id || batch.batchId || '',
                batch.session_id || batch.sessionId || '',
                batch.status,
                typeof batch.messages === 'string' ? batch.messages : JSON.stringify(batch.messages || []),
                typeof batch.options === 'string' ? batch.options : JSON.stringify(batch.options || {}),
                typeof batch.progress === 'string' ? batch.progress : JSON.stringify(batch.progress || {}),
                typeof batch.results === 'string' ? batch.results : JSON.stringify(batch.results || []),
                batch.current_index ?? batch.currentIndex ?? 0,
                batch.created_at || batch.createdAt,
                batch.updated_at || batch.updatedAt,
                batch.started_at ?? batch.startedAt ?? null,
                batch.completed_at ?? batch.completedAt ?? null,
              ],
            );
            messageBatchesCount++;
          } catch (err) {
            warnings.push(
              `Failed to import message batch ${batch.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      return {
        imported: true,
        counts: {
          sessions: sessionsCount,
          webhooks: webhooksCount,
          messages: messagesCount,
          messageBatches: messageBatchesCount,
        },
        warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================================================
  // STORAGE MIGRATION API
  // ============================================================================

  @Get('storage/files/count')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get file count in current storage' })
  @ApiResponse({ status: 200, description: 'File count and size' })
  async getStorageFileCount(): Promise<{
    storageType: string;
    count: number;
    sizeBytes: number;
    sizeMB: string;
  }> {
    const { count, sizeBytes } = await this.storageService.getFileCount();
    return {
      storageType: this.storageService.getCurrentStorageType(),
      count,
      sizeBytes,
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
    };
  }

  @Get('storage/export')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Export all storage files as tar.gz' })
  @ApiResponse({ status: 200, description: 'Tar.gz archive stream' })
  async exportStorage(): Promise<{ message: string; download: string }> {
    try {
      const stream = await this.storageService.createExportStream();
      const exportPath = path.join(process.cwd(), 'data', `storage-export-${Date.now()}.tar.gz`);

      const writeStream = fs.createWriteStream(exportPath);
      stream.pipe(writeStream);

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return {
        message: 'Storage export completed',
        download: path.basename(exportPath),
      };
    } catch (error) {
      this.logger.error('Storage export failed', undefined, { error: String(error) });
      throw new InternalServerErrorException('Storage export failed. Check server logs.');
    }
  }

  @Post('storage/import')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Import storage files from tar.gz' })
  @ApiBody({ description: 'Path to tar.gz file to import' })
  @ApiResponse({ status: 200, description: 'Import result' })
  async importStorage(
    @Body() body: { filePath: string },
  ): Promise<{ imported: boolean; count: number; storageType: string }> {
    try {
      const { filePath } = body;
      const resolvedFilePath = path.resolve(filePath);
      const allowedRoot = path.resolve(process.cwd(), 'data');

      if (!resolvedFilePath.startsWith(`${allowedRoot}${path.sep}`)) {
        throw new BadRequestException('File path must be within the data directory');
      }

      if (!fs.existsSync(resolvedFilePath)) {
        this.logger.warn('Import file not found', { resolvedFilePath });
        throw new BadRequestException('Specified file was not found');
      }

      const readStream = fs.createReadStream(resolvedFilePath);
      const count = await this.storageService.importFromStream(readStream);

      return {
        imported: true,
        count,
        storageType: this.storageService.getCurrentStorageType(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Storage import failed', undefined, { error: String(error) });
      throw new BadRequestException('Storage import failed. Check server logs.');
    }
  }
}
