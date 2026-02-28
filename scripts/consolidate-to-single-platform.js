#!/usr/bin/env node

/**
 * Consolidate all users and projects to a single main platform
 * - Merges all platforms into one
 * - Ensures each identity has only one user record
 * - Moves all projects to the main platform
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

function generateId() {
    return crypto.randomBytes(10).toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 21);
}

// Load environment variables
function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
    }
}

loadEnvFile();

async function consolidateToSinglePlatform() {
    let dataSource;
    
    try {
        const dbType = process.env.AP_DB_TYPE || 'SQLITE3';
        
        if (dbType === 'POSTGRES') {
            const postgresUrl = process.env.AP_POSTGRES_URL;
            if (postgresUrl) {
                dataSource = new DataSource({
                    type: 'postgres',
                    url: postgresUrl,
                });
            } else {
                dataSource = new DataSource({
                    type: 'postgres',
                    host: process.env.AP_POSTGRES_HOST || 'localhost',
                    port: parseInt(process.env.AP_POSTGRES_PORT || '5432'),
                    username: process.env.AP_POSTGRES_USERNAME || 'postgres',
                    password: process.env.AP_POSTGRES_PASSWORD || 'postgres',
                    database: process.env.AP_POSTGRES_DATABASE || 'postgres',
                });
            }
        } else {
            const devConfigPath = path.join(process.cwd(), 'dev', 'config', 'database.sqlite');
            let sqlitePath;
            if (fs.existsSync(devConfigPath)) {
                sqlitePath = path.resolve(devConfigPath);
            } else {
                const configPath = process.env.AP_CONFIG_PATH || path.join(os.homedir(), '.activepieces');
                sqlitePath = path.resolve(path.join(configPath, 'database.sqlite'));
            }
            
            dataSource = new DataSource({
                type: 'sqlite',
                database: sqlitePath,
            });
        }
        
        await dataSource.initialize();
        console.log('✅ Database connected\n');
        
        // Step 1: Get or create main platform
        console.log('='.repeat(60));
        console.log('Step 1: Getting/Creating Main Platform');
        console.log('='.repeat(60));
        
        let mainPlatform;
        if (dbType === 'POSTGRES') {
            const platforms = await dataSource.query(`SELECT * FROM platform ORDER BY created LIMIT 1`);
            if (platforms.length > 0) {
                mainPlatform = platforms[0];
                console.log(`✅ Using existing platform: ${mainPlatform.name} (${mainPlatform.id})`);
            } else {
                // Create main platform
                const platformId = generateId();
                const ownerId = generateId(); // We'll update this later
                await dataSource.query(
                    `INSERT INTO platform (id, created, updated, name, "ownerId", "primaryColor", "logoIconUrl", "fullLogoUrl", "favIconUrl", "cloudAuthEnabled", "filteredPieceNames", "filteredPieceBehavior", "emailAuthEnabled", "enforceAllowedAuthDomains", "allowedAuthDomains", "federatedAuthProviders", "pinnedPieces")
                     VALUES ($1, NOW(), NOW(), 'Main Platform', $2, '#6e41e2', 'https://cdn.activepieces.com/brand/logo.svg', 'https://cdn.activepieces.com/brand/full-logo.png', 'https://cdn.activepieces.com/brand/favicon.ico', true, '{}', 'BLOCKED', true, false, '{}', '{}', '[]')`,
                    [platformId, ownerId]
                );
                mainPlatform = { id: platformId, ownerId };
                console.log(`✅ Created main platform: ${platformId}`);
            }
        } else {
            const platforms = await dataSource.query(`SELECT * FROM platform ORDER BY created LIMIT 1`);
            if (platforms.length > 0) {
                mainPlatform = platforms[0];
                console.log(`✅ Using existing platform: ${mainPlatform.name} (${mainPlatform.id})`);
            } else {
                const platformId = generateId();
                const ownerId = generateId();
                await dataSource.query(
                    `INSERT INTO platform (id, created, updated, name, ownerId, primaryColor, logoIconUrl, fullLogoUrl, favIconUrl, cloudAuthEnabled, filteredPieceNames, filteredPieceBehavior, emailAuthEnabled, enforceAllowedAuthDomains, allowedAuthDomains, federatedAuthProviders, pinnedPieces)
                     VALUES (?, datetime('now'), datetime('now'), 'Main Platform', ?, '#6e41e2', 'https://cdn.activepieces.com/brand/logo.svg', 'https://cdn.activepieces.com/brand/full-logo.png', 'https://cdn.activepieces.com/brand/favicon.ico', 1, '[]', 'BLOCKED', 1, 0, '[]', '{}', '[]')`,
                    [platformId, ownerId]
                );
                mainPlatform = { id: platformId, ownerId };
                console.log(`✅ Created main platform: ${platformId}`);
            }
        }
        
        const mainPlatformId = mainPlatform.id;
        console.log(`\nMain Platform ID: ${mainPlatformId}\n`);
        
        // Step 2: Consolidate users - one per identity
        console.log('='.repeat(60));
        console.log('Step 2: Consolidating Users (One Per Identity)');
        console.log('='.repeat(60));
        
        // Get all identities
        let identities;
        if (dbType === 'POSTGRES') {
            identities = await dataSource.query(`SELECT * FROM user_identity ORDER BY created`);
        } else {
            identities = await dataSource.query(`SELECT * FROM user_identity ORDER BY created`);
        }
        
        console.log(`Found ${identities.length} identities\n`);
        
        let usersConsolidated = 0;
        let usersDeleted = 0;
        
        for (const identity of identities) {
            // Get all users for this identity
            let users;
            if (dbType === 'POSTGRES') {
                users = await dataSource.query(
                    `SELECT * FROM "user" WHERE "identityId" = $1 ORDER BY created`,
                    [identity.id]
                );
            } else {
                users = await dataSource.query(
                    `SELECT * FROM user WHERE identityId = ? ORDER BY created`,
                    [identity.id]
                );
            }
            
            if (users.length === 0) {
                // Create user for this identity
                const userId = generateId();
                if (dbType === 'POSTGRES') {
                    await dataSource.query(
                        `INSERT INTO "user" (id, created, updated, status, "platformRole", "identityId", "platformId")
                         VALUES ($1, NOW(), NOW(), 'ACTIVE', 'MEMBER', $2, $3)`,
                        [userId, identity.id, mainPlatformId]
                    );
                } else {
                    await dataSource.query(
                        `INSERT INTO user (id, created, updated, status, platformRole, identityId, platformId)
                         VALUES (?, datetime('now'), datetime('now'), 'ACTIVE', 'MEMBER', ?, ?)`,
                        [userId, identity.id, mainPlatformId]
                    );
                }
                usersConsolidated++;
                console.log(`  ✅ Created user for identity ${identity.email}`);
            } else {
                // One or more users — prefer the one already on main platform
                const mainPlatformUser = users.find(u => u.platformId === mainPlatformId);
                const keepUser = mainPlatformUser || users[0];
                const deleteUsers = users.filter(u => u.id !== keepUser.id);
                
                // First: move all records from duplicate users to kept user, then delete them
                for (const deleteUser of deleteUsers) {
                    // ALL tables that reference user(id) - must reassign before DELETE
                    const userRefTables = [
                        { table: 'platform', col: 'ownerId' },        // RESTRICT - must update
                        { table: 'project', col: 'ownerId' },         // NO ACTION
                        { table: 'project_member', col: 'userId' },   // CASCADE
                        { table: 'app_connection', col: 'ownerId' },  // SET NULL
                        { table: 'flow_comment', col: 'userId' },     // SET NULL
                        { table: 'flow_version', col: 'updatedBy' },  // SET NULL
                        { table: 'todo', col: 'createdByUserId' },    // CASCADE
                        { table: 'todo', col: 'assigneeId' },         // CASCADE
                        { table: 'todo_activity', col: 'userId' },    // CASCADE
                        { table: 'flow_activity', col: 'userId' },    // might exist
                        { table: 'project_release', col: 'userId' },  // might exist
                    ];
                    for (const { table, col } of userRefTables) {
                        try {
                            if (dbType === 'POSTGRES') {
                                await dataSource.query(
                                    `UPDATE "${table}" SET "${col}" = $1 WHERE "${col}" = $2`,
                                    [keepUser.id, deleteUser.id]
                                );
                            } else {
                                await dataSource.query(
                                    `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`,
                                    [keepUser.id, deleteUser.id]
                                );
                            }
                        } catch (e) {
                            // Table might not exist - that's fine
                        }
                    }
                    if (dbType === 'POSTGRES') {
                        await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [deleteUser.id]);
                    } else {
                        await dataSource.query(`DELETE FROM user WHERE id = ?`, [deleteUser.id]);
                    }
                    usersDeleted++;
                }
                
                // Now safe to update kept user to main platform (duplicates are gone)
                if (keepUser.platformId !== mainPlatformId) {
                    if (dbType === 'POSTGRES') {
                        await dataSource.query(
                            `UPDATE "user" SET "platformId" = $1 WHERE id = $2`,
                            [mainPlatformId, keepUser.id]
                        );
                    } else {
                        await dataSource.query(
                            `UPDATE user SET platformId = ? WHERE id = ?`,
                            [mainPlatformId, keepUser.id]
                        );
                    }
                }
                
                usersConsolidated++;
                console.log(`  ✅ Consolidated ${users.length} users for identity ${identity.email} (kept 1, deleted ${deleteUsers.length})`);
            }
        }
        
        console.log(`\n✅ Consolidated users: ${usersConsolidated} identities processed, ${usersDeleted} duplicate users deleted\n`);
        
        // Step 3: Move ALL platform-scoped records to main platform
        console.log('='.repeat(60));
        console.log('Step 3: Moving All Records to Main Platform');
        console.log('='.repeat(60));
        
        // List of tables with platformId columns that need updating
        // Update them ALL before we attempt to delete other platforms
        const tablesToUpdate = [
            { table: 'project', quoted: '"project"' },
            { table: 'project_member', quoted: '"project_member"' },
            { table: 'app_connection', quoted: '"app_connection"' },
            { table: 'user_invitation', quoted: '"user_invitation"' },
            { table: 'todo', quoted: '"todo"' },
            { table: 'tag', quoted: '"tag"' },
            { table: 'piece_tag', quoted: '"piece_tag"' },
        ];
        
        for (const { table, quoted } of tablesToUpdate) {
            try {
                if (dbType === 'POSTGRES') {
                    const result = await dataSource.query(
                        `UPDATE ${quoted} SET "platformId" = $1 WHERE "platformId" != $1 OR "platformId" IS NULL`,
                        [mainPlatformId]
                    );
                    console.log(`  ✅ ${table}: updated ${result?.rowCount || 0} rows`);
                } else {
                    await dataSource.query(
                        `UPDATE ${table} SET platformId = ? WHERE platformId != ? OR platformId IS NULL`,
                        [mainPlatformId, mainPlatformId]
                    );
                    console.log(`  ✅ ${table}: updated`);
                }
            } catch (e) {
                // Table might not exist in this edition - that's fine
                console.log(`  ⚠️  ${table}: skipped (${e.message.substring(0, 60)})`);
            }
        }
        
        console.log('');
        
        // Step 4: Update all users to main platform
        console.log('='.repeat(60));
        console.log('Step 4: Updating All Users to Main Platform');
        console.log('='.repeat(60));
        
        if (dbType === 'POSTGRES') {
            const result = await dataSource.query(
                `UPDATE "user" SET "platformId" = $1 WHERE "platformId" != $1 OR "platformId" IS NULL`,
                [mainPlatformId]
            );
            console.log(`✅ Updated ${result?.rowCount || 0} users to main platform\n`);
        } else {
            await dataSource.query(
                `UPDATE user SET platformId = ? WHERE platformId != ? OR platformId IS NULL`,
                [mainPlatformId, mainPlatformId]
            );
            console.log(`✅ Updated users to main platform\n`);
        }
        
        // Step 5: Delete records from other platforms that have RESTRICT FK constraints
        // These must be deleted BEFORE we can delete the other platforms
        console.log('='.repeat(60));
        console.log('Step 5: Cleaning Up FK-Constrained Records');
        console.log('='.repeat(60));
        
        const tablesToDeleteFrom = [
            'signing_key',
        ];
        
        for (const table of tablesToDeleteFrom) {
            try {
                if (dbType === 'POSTGRES') {
                    await dataSource.query(
                        `DELETE FROM "${table}" WHERE "platformId" != $1`,
                        [mainPlatformId]
                    );
                } else {
                    await dataSource.query(
                        `DELETE FROM ${table} WHERE platformId != ?`,
                        [mainPlatformId]
                    );
                }
                console.log(`  ✅ ${table}: cleaned up`);
            } catch (e) {
                console.log(`  ⚠️  ${table}: skipped (${e.message.substring(0, 60)})`);
            }
        }
        
        console.log('');
        
        // Step 6: Delete other platforms
        console.log('='.repeat(60));
        console.log('Step 6: Deleting Other Platforms');
        console.log('='.repeat(60));
        
        let platformsDeleted = 0;
        if (dbType === 'POSTGRES') {
            const result = await dataSource.query(
                `DELETE FROM platform WHERE id != $1`,
                [mainPlatformId]
            );
            platformsDeleted = result?.rowCount || 0;
        } else {
            const before = await dataSource.query(`SELECT COUNT(*) as count FROM platform WHERE id != ?`, [mainPlatformId]);
            platformsDeleted = parseInt(before[0].count);
            await dataSource.query(
                `DELETE FROM platform WHERE id != ?`,
                [mainPlatformId]
            );
        }
        
        console.log(`✅ Deleted ${platformsDeleted} other platforms\n`);
        
        // Step 7: Update platform owner to first admin user
        console.log('='.repeat(60));
        console.log('Step 7: Setting Platform Owner');
        console.log('='.repeat(60));
        
        let adminUser;
        if (dbType === 'POSTGRES') {
            adminUser = await dataSource.query(
                `SELECT * FROM "user" WHERE "platformRole" = 'ADMIN' AND "platformId" = $1 ORDER BY created LIMIT 1`,
                [mainPlatformId]
            );
            if (adminUser.length > 0) {
                await dataSource.query(
                    `UPDATE platform SET "ownerId" = $1 WHERE id = $2`,
                    [adminUser[0].id, mainPlatformId]
                );
                console.log(`✅ Set platform owner to user ${adminUser[0].id}`);
            } else {
                // Make first user admin
                const firstUser = await dataSource.query(
                    `SELECT * FROM "user" WHERE "platformId" = $1 ORDER BY created LIMIT 1`,
                    [mainPlatformId]
                );
                if (firstUser.length > 0) {
                    await dataSource.query(
                        `UPDATE "user" SET "platformRole" = 'ADMIN' WHERE id = $1`,
                        [firstUser[0].id]
                    );
                    await dataSource.query(
                        `UPDATE platform SET "ownerId" = $1 WHERE id = $2`,
                        [firstUser[0].id, mainPlatformId]
                    );
                    console.log(`✅ Made first user admin and set as platform owner`);
                }
            }
        } else {
            adminUser = await dataSource.query(
                `SELECT * FROM user WHERE platformRole = 'ADMIN' AND platformId = ? ORDER BY created LIMIT 1`,
                [mainPlatformId]
            );
            if (adminUser.length > 0) {
                await dataSource.query(
                    `UPDATE platform SET ownerId = ? WHERE id = ?`,
                    [adminUser[0].id, mainPlatformId]
                );
                console.log(`✅ Set platform owner to user ${adminUser[0].id}`);
            } else {
                const firstUser = await dataSource.query(
                    `SELECT * FROM user WHERE platformId = ? ORDER BY created LIMIT 1`,
                    [mainPlatformId]
                );
                if (firstUser.length > 0) {
                    await dataSource.query(
                        `UPDATE user SET platformRole = 'ADMIN' WHERE id = ?`,
                        [firstUser[0].id]
                    );
                    await dataSource.query(
                        `UPDATE platform SET ownerId = ? WHERE id = ?`,
                        [firstUser[0].id, mainPlatformId]
                    );
                    console.log(`✅ Made first user admin and set as platform owner`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ CONSOLIDATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`Main Platform ID: ${mainPlatformId}`);
        console.log(`Users consolidated: ${usersConsolidated}`);
        console.log(`Duplicate users deleted: ${usersDeleted}`);
        console.log(`Other platforms deleted: ${platformsDeleted}`);
        console.log('\nAll users now belong to a single platform!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

consolidateToSinglePlatform();
