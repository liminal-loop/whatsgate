import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignPostgresJsonbColumns1770112000000 implements MigrationInterface {
  name = 'AlignPostgresJsonbColumns1770112000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION openwa_try_parse_jsonb(input_text text)
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN input_text::jsonb;
      EXCEPTION
        WHEN others THEN
          RETURN to_jsonb(input_text);
      END;
      $$;
    `);

    await this.convertToJsonb(queryRunner, 'sessions', 'config');
    await this.convertToJsonb(queryRunner, 'webhooks', 'events');
    await this.convertToJsonb(queryRunner, 'webhooks', 'headers');
    await this.convertToJsonb(queryRunner, 'messages', 'metadata');
    await this.convertToJsonb(queryRunner, 'message_batches', 'messages');
    await this.convertToJsonb(queryRunner, 'message_batches', 'options');
    await this.convertToJsonb(queryRunner, 'message_batches', 'progress');
    await this.convertToJsonb(queryRunner, 'message_batches', 'results');
    await this.convertToJsonb(queryRunner, 'audit_logs', 'metadata');

    await this.setJsonbDefault(queryRunner, 'sessions', 'config', "'{}'::jsonb");
    await this.setJsonbDefault(queryRunner, 'webhooks', 'events', '\'["message.received"]\'::jsonb');
    await this.setJsonbDefault(queryRunner, 'webhooks', 'headers', "'{}'::jsonb");
    await this.expandApiKeyPrefix(queryRunner);

    await queryRunner.query(`DROP FUNCTION IF EXISTS openwa_try_parse_jsonb(text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await this.convertToText(queryRunner, 'audit_logs', 'metadata');
    await this.convertToText(queryRunner, 'message_batches', 'results');
    await this.convertToText(queryRunner, 'message_batches', 'progress');
    await this.convertToText(queryRunner, 'message_batches', 'options');
    await this.convertToText(queryRunner, 'message_batches', 'messages');
    await this.convertToText(queryRunner, 'messages', 'metadata');
    await this.convertToText(queryRunner, 'webhooks', 'headers');
    await this.convertToText(queryRunner, 'webhooks', 'events');
    await this.convertToText(queryRunner, 'sessions', 'config');

    await this.setTextDefault(queryRunner, 'sessions', 'config', "'{}'");
    await this.setTextDefault(queryRunner, 'webhooks', 'events', '\'["message.received"]\'');
    await this.setTextDefault(queryRunner, 'webhooks', 'headers', "'{}'");
    await this.shrinkApiKeyPrefix(queryRunner);
  }

  private async convertToJsonb(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${columnName}'
            AND data_type <> 'jsonb'
        ) THEN
          EXECUTE 'ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE jsonb USING CASE WHEN "${columnName}" IS NULL THEN NULL ELSE openwa_try_parse_jsonb("${columnName}"::text) END';
        END IF;
      END $$;
    `);
  }

  private async convertToText(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${columnName}'
            AND data_type = 'jsonb'
        ) THEN
          EXECUTE 'ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE text USING "${columnName}"::text';
        END IF;
      END $$;
    `);
  }

  private async setJsonbDefault(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    defaultValue: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${columnName}'
            AND data_type = 'jsonb'
        ) THEN
          EXECUTE 'ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValue}';
        END IF;
      END $$;
    `);
  }

  private async setTextDefault(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    defaultValue: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name = '${columnName}'
            AND data_type IN ('text', 'character varying')
        ) THEN
          EXECUTE 'ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValue}';
        END IF;
      END $$;
    `);
  }

  private async expandApiKeyPrefix(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'api_keys'
            AND column_name = 'keyPrefix'
            AND character_maximum_length IS NOT NULL
            AND character_maximum_length < 12
        ) THEN
          ALTER TABLE "api_keys" ALTER COLUMN "keyPrefix" TYPE varchar(12);
        END IF;
      END $$;
    `);
  }

  private async shrinkApiKeyPrefix(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'api_keys'
            AND column_name = 'keyPrefix'
            AND character_maximum_length IS NOT NULL
            AND character_maximum_length >= 12
        ) THEN
          ALTER TABLE "api_keys" ALTER COLUMN "keyPrefix" TYPE varchar(8);
        END IF;
      END $$;
    `);
  }
}
