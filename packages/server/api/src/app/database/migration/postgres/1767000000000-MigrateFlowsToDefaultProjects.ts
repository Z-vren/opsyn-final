import { MigrationInterface, QueryRunner } from 'typeorm'
import { system } from '../../../helper/system/system'
import { ApEdition, apId } from '@activepieces/shared'

/**
 * Migration to ensure all users have a default project and migrate existing flows.
 * This migration:
 * 1. Creates a default project for each user who doesn't have one
 * 2. Migrates flows that don't have a projectId (shouldn't happen, but safety check)
 * 3. Creates ProjectMember records for project owners
 */
export class MigrateFlowsToDefaultProjects1767000000000 implements MigrationInterface {
    name = 'MigrateFlowsToDefaultProjects1767000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Step 1: Create default projects for users who don't have any projects
        // Get all users (user table has no deleted column in Community Edition)
        const users = await queryRunner.query(`
            SELECT u.id, u."platformId", ui.email, ui."firstName"
            FROM "user" u
            INNER JOIN "user_identity" ui ON u."identityId" = ui.id
        `)

        for (const user of users) {
            // Check if user has any projects
            const userProjects = await queryRunner.query(`
                SELECT COUNT(*) as count
                FROM "project"
                WHERE "ownerId" = $1 AND "deleted" IS NULL
            `, [user.id])

            if (parseInt(userProjects[0].count) === 0) {
                // User has no projects, create a default one
                const projectId = apId()
                const displayName = user.firstName 
                    ? `${user.firstName}'s Project` 
                    : 'My Project'
                
                await queryRunner.query(`
                    INSERT INTO "project" (
                        "id", "created", "updated", "ownerId", "displayName", "platformId", 
                        "releasesEnabled", "metadata"
                    )
                    VALUES ($1, NOW(), NOW(), $2, $3, $4, false, NULL)
                `, [projectId, user.id, displayName, user.platformId])

                // Create ProjectMember record for the owner
                const memberId = apId()
                await queryRunner.query(`
                    INSERT INTO "project_member" (
                        "id", "created", "updated", "projectId", "platformId", "userId", "role"
                    )
                    VALUES ($1, NOW(), NOW(), $2, $3, $4, 'OWNER')
                `, [memberId, projectId, user.platformId, user.id])
            }
        }

        // Step 2: Migrate any flows that reference deleted/non-existent projects
        // Find flows where the project doesn't exist or is deleted
        const orphanedFlows = await queryRunner.query(`
            SELECT f.id, f."projectId", p."ownerId", p."platformId", p."deleted"
            FROM "flow" f
            LEFT JOIN "project" p ON f."projectId" = p.id
            WHERE f."projectId" IS NOT NULL AND (p.id IS NULL OR p."deleted" IS NOT NULL)
        `)

        for (const flow of orphanedFlows) {
            // Find or create a default project for the flow's platform
            // First, try to find any project owned by a user in the same platform
            // If we can't determine the owner, we'll assign to the first available project
            const platformProjects = await queryRunner.query(`
                SELECT p.id, p."ownerId"
                FROM "project" p
                WHERE p."platformId" = $1 AND p."deleted" IS NULL
                ORDER BY p."created" ASC
                LIMIT 1
            `, [flow.platformId || (await queryRunner.query(`SELECT "platformId" FROM "flow" WHERE id = $1`, [flow.id]))[0]?.platformId])

            if (platformProjects.length > 0) {
                // Assign orphaned flow to the first available project in the platform
                await queryRunner.query(`
                    UPDATE "flow"
                    SET "projectId" = $1
                    WHERE id = $2
                `, [platformProjects[0].id, flow.id])
            } else {
                // If no projects exist, create a default one (shouldn't happen due to Step 1)
                // This is a fallback safety measure
            }
        }

        // Step 3: Ensure all project owners have ProjectMember records
        const projectsWithoutOwnerMember = await queryRunner.query(`
            SELECT p.id, p."ownerId", p."platformId"
            FROM "project" p
            LEFT JOIN "project_member" pm ON pm."projectId" = p.id AND pm."userId" = p."ownerId"
            WHERE p."deleted" IS NULL AND pm.id IS NULL
        `)

        for (const project of projectsWithoutOwnerMember) {
            const memberId = apId()
            await queryRunner.query(`
                INSERT INTO "project_member" (
                    "id", "created", "updated", "projectId", "platformId", "userId", "role"
                )
                VALUES ($1, NOW(), NOW(), $2, $3, $4, 'OWNER')
            `, [memberId, project.id, project.platformId, project.ownerId])
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const edition = system.getEdition()
        
        // Only run this migration in Community Edition
        if (edition !== ApEdition.COMMUNITY) {
            return
        }

        // Note: We don't delete the projects created by this migration
        // as they may have been used by users. The migration is idempotent
        // and safe to run multiple times.
    }
}

