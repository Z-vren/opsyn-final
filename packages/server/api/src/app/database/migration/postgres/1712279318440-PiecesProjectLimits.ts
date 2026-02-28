import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'
import { isNotOneOfTheseEditions } from '../../database-common'

const log = system.globalLogger()

export class PiecesProjectLimits1712279318440 implements MigrationInterface {
    name = 'PiecesProjectLimits1712279318440'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        const tableExists = await queryRunner.hasTable('project_plan')

        if (edition === ApEdition.COMMUNITY) {
            if (!tableExists) {
                log.info({ name: 'PiecesProjectLimits1712279318440' }, 'Creating project_plan table for Community Edition')
                await queryRunner.query(`
                    CREATE TABLE "project_plan" (
                        "id" character varying(21) NOT NULL,
                        "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                        "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                        "projectId" character varying(21) NOT NULL,
                        "name" character varying NOT NULL,
                        "pieces" character varying array NOT NULL DEFAULT ARRAY[]::varchar[],
                        "piecesFilterType" character varying NOT NULL DEFAULT 'NONE',
                        "locked" boolean NOT NULL DEFAULT false,
                        "aiCredits" integer,
                        CONSTRAINT "REL_4f52e89612966d95843e4158bb" UNIQUE ("projectId"),
                        CONSTRAINT "PK_759d33fce71c95de832df935841" PRIMARY KEY ("id")
                    )
                `)
                await queryRunner.query(`
                    CREATE UNIQUE INDEX "idx_plan_project_id" ON "project_plan" ("projectId")
                `)
            } else {
                log.info({ name: 'PiecesProjectLimits1712279318440' }, 'Altering existing project_plan table for Community Edition')
                await queryRunner.query(`ALTER TABLE "project_plan" ADD COLUMN IF NOT EXISTS "pieces" character varying[] NOT NULL DEFAULT ARRAY[]::varchar[]`)
                await queryRunner.query(`ALTER TABLE "project_plan" ADD COLUMN IF NOT EXISTS "piecesFilterType" character varying NOT NULL DEFAULT 'NONE'`)
                await queryRunner.query(`ALTER TABLE "project_plan" ADD COLUMN IF NOT EXISTS "locked" boolean NOT NULL DEFAULT false`)
                await queryRunner.query(`ALTER TABLE "project_plan" ADD COLUMN IF NOT EXISTS "aiCredits" integer`)
                await queryRunner.query(`ALTER TABLE "project_plan" DROP COLUMN IF EXISTS "stripeCustomerId"`)
                await queryRunner.query(`ALTER TABLE "project_plan" DROP COLUMN IF EXISTS "stripeSubscriptionId"`)
                await queryRunner.query(`ALTER TABLE "project_plan" DROP COLUMN IF EXISTS "subscriptionStartDatetime"`)
                await queryRunner.query(`ALTER TABLE "project_plan" DROP COLUMN IF EXISTS "tasksPerDay"`)
                await queryRunner.query(`DROP INDEX IF EXISTS "idx_plan_stripe_customer_id"`)
            }
            return
        }

        if (isNotOneOfTheseEditions([ApEdition.CLOUD, ApEdition.ENTERPRISE])) {
            return
        }

        if (!tableExists) {
            log.warn({ name: 'PiecesProjectLimits1712279318440' }, 'project_plan table does not exist, skipping migration')
            return
        }
        
        log.info({
            name: 'PiecesProjectLimits1712279318440' },
        'up')
        
        const hasFlowPlanName = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='project_plan' AND column_name='flowPlanName'
        `)
        
        if (hasFlowPlanName.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "project_plan" RENAME COLUMN "flowPlanName" TO "name"
            `)
        }
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "stripeCustomerId"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "stripeSubscriptionId"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "subscriptionStartDatetime"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "tasksPerDay"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "pieces" character varying array
        `)
        await queryRunner.query(`
            UPDATE "project_plan"
            SET "pieces" = ARRAY[]::varchar[]
        `)

        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ALTER COLUMN "pieces" SET NOT NULL;
        `)


        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "piecesFilterType" character varying
        `)
        await queryRunner.query(`
            UPDATE "project_plan"
            SET "piecesFilterType" = 'NONE'
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ALTER COLUMN "piecesFilterType" SET NOT NULL
        `)

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (isNotOneOfTheseEditions([ApEdition.CLOUD, ApEdition.ENTERPRISE])) {
            return
        }
        await queryRunner.query(`
            ALTER TABLE "project_plan" RENAME COLUMN "name" TO "flowPlanName"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "piecesFilterType"
        `)
        await queryRunner.query(`
            DROP TYPE "project_plan_piecesfiltertype_enum"
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan" DROP COLUMN "pieces"
        `)

        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "tasksPerDay" integer
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "subscriptionStartDatetime" TIMESTAMP WITH TIME ZONE NOT NULL
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "stripeSubscriptionId" character varying
        `)
        await queryRunner.query(`
            ALTER TABLE "project_plan"
            ADD "stripeCustomerId" character varying
        `)
    }

}
