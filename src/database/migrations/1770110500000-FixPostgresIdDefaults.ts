import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPostgresIdDefaults1770110500000 implements MigrationInterface {
  name = 'FixPostgresIdDefaults1770110500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    // Ensure UUID generation function is available in PostgreSQL.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
    await queryRunner.query(`ALTER TABLE "webhooks" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
    await queryRunner.query(`ALTER TABLE "message_batches" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
    await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid()::text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "message_batches" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "webhooks" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT`);
  }
}
