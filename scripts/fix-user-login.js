#!/usr/bin/env node

/**
 * Script to diagnose and fix user login issues
 * Fixes: email verification, platform association, user record creation
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Simple ID generator (21 chars, similar to apId)
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

const email = process.argv[2];
if (!email) {
    console.error('Usage: node fix-user-login.js <email>');
    process.exit(1);
}

async function fixUserLogin() {
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
        
        const cleanedEmail = email.toLowerCase().trim();
        
        // Step 1: Check user identity
        console.log('📧 Checking user identity...');
        let userIdentity;
        if (dbType === 'POSTGRES') {
            userIdentity = await dataSource.query(
                `SELECT * FROM user_identity WHERE LOWER(TRIM(email)) = $1`,
                [cleanedEmail]
            );
        } else {
            userIdentity = await dataSource.query(
                `SELECT * FROM user_identity WHERE LOWER(TRIM(email)) = ?`,
                [cleanedEmail]
            );
        }
        
        if (!userIdentity || userIdentity.length === 0) {
            console.error(`❌ User identity with email ${email} not found`);
            console.error('   The user needs to sign up first.');
            process.exit(1);
        }
        
        const identity = userIdentity[0];
        console.log(`   Found identity: ${identity.email}`);
        console.log(`   Verified: ${identity.verified}`);
        console.log(`   ID: ${identity.id}\n`);
        
        // Step 2: Fix email verification if needed
        if (!identity.verified) {
            console.log('🔧 Fixing email verification...');
            if (dbType === 'POSTGRES') {
                await dataSource.query(
                    `UPDATE user_identity SET verified = true WHERE id = $1`,
                    [identity.id]
                );
            } else {
                await dataSource.query(
                    `UPDATE user_identity SET verified = 1 WHERE id = ?`,
                    [identity.id]
                );
            }
            console.log('   ✅ Email verified\n');
        } else {
            console.log('   ✅ Email already verified\n');
        }
        
        // Step 3: Check for user records
        console.log('👤 Checking user records...');
        let users;
        if (dbType === 'POSTGRES') {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name 
                 FROM "user" u 
                 LEFT JOIN platform p ON u."platformId" = p.id 
                 WHERE u."identityId" = $1`,
                [identity.id]
            );
        } else {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name 
                 FROM user u 
                 LEFT JOIN platform p ON u.platformId = p.id 
                 WHERE u.identityId = ?`,
                [identity.id]
            );
        }
        
        if (users.length === 0) {
            console.log('   ⚠️  No user records found. Creating user and platform...');
            
            // Create a platform for this user
            const platformId = generateId();
            const platformName = `${identity.firstName}'s Platform`;
            
            if (dbType === 'POSTGRES') {
                await dataSource.query(
                    `INSERT INTO platform (id, "created", "updated", name, "ownerId", "enforceAllowedAuthDomains", "emailAuthEnabled", "federatedAuthProviders")
                     VALUES ($1, NOW(), NOW(), $2, NULL, false, true, '{}')`,
                    [platformId, platformName]
                );
            } else {
                await dataSource.query(
                    `INSERT INTO platform (id, created, updated, name, ownerId, enforceAllowedAuthDomains, emailAuthEnabled, federatedAuthProviders)
                     VALUES (?, datetime('now'), datetime('now'), ?, NULL, 0, 1, '{}')`,
                    [platformId, platformName]
                );
            }
            
            console.log(`   ✅ Created platform: ${platformName} (${platformId})`);
            
            // Create user record
            const userId = generateId();
            if (dbType === 'POSTGRES') {
                await dataSource.query(
                    `INSERT INTO "user" (id, "created", "updated", status, "platformRole", "identityId", "platformId")
                     VALUES ($1, NOW(), NOW(), 'ACTIVE', 'ADMIN', $2, $3)`,
                    [userId, identity.id, platformId]
                );
                
                // Update platform owner
                await dataSource.query(
                    `UPDATE platform SET "ownerId" = $1 WHERE id = $2`,
                    [userId, platformId]
                );
            } else {
                await dataSource.query(
                    `INSERT INTO user (id, created, updated, status, platformRole, identityId, platformId)
                     VALUES (?, datetime('now'), datetime('now'), 'ACTIVE', 'ADMIN', ?, ?)`,
                    [userId, identity.id, platformId]
                );
                
                await dataSource.query(
                    `UPDATE platform SET ownerId = ? WHERE id = ?`,
                    [userId, platformId]
                );
            }
            
            console.log(`   ✅ Created user record: ${userId}`);
            
            // Create a default project
            const projectId = generateId();
            const projectName = `${identity.firstName}'s Project`;
            
            if (dbType === 'POSTGRES') {
                await dataSource.query(
                    `INSERT INTO project (id, "created", "updated", "displayName", "ownerId", "platformId", "notifyStatus")
                     VALUES ($1, NOW(), NOW(), $2, $3, $4, 'ALWAYS')`,
                    [projectId, projectName, userId, platformId]
                );
            } else {
                await dataSource.query(
                    `INSERT INTO project (id, created, updated, displayName, ownerId, platformId, notifyStatus)
                     VALUES (?, datetime('now'), datetime('now'), ?, ?, ?, 'ALWAYS')`,
                    [projectId, projectName, userId, platformId]
                );
            }
            
            console.log(`   ✅ Created default project: ${projectName} (${projectId})\n`);
            
            users = [{
                id: userId,
                platformId: platformId,
                platform_name: platformName,
                status: 'ACTIVE'
            }];
        } else {
            console.log(`   ✅ Found ${users.length} user record(s)\n`);
            
            // Check if user status is ACTIVE
            for (const user of users) {
                if (user.status !== 'ACTIVE') {
                    console.log(`   🔧 Fixing user status for ${user.id}...`);
                    if (dbType === 'POSTGRES') {
                        await dataSource.query(
                            `UPDATE "user" SET status = 'ACTIVE' WHERE id = $1`,
                            [user.id]
                        );
                    } else {
                        await dataSource.query(
                            `UPDATE user SET status = 'ACTIVE' WHERE id = ?`,
                            [user.id]
                        );
                    }
                    console.log(`   ✅ User status set to ACTIVE\n`);
                }
            }
        }
        
        // Step 4: Verify platform exists and has projects
        if (users.length > 0 && users[0].platformId) {
            const platformId = users[0].platformId;
            console.log('📁 Checking platform and projects...');
            
            let projects;
            if (dbType === 'POSTGRES') {
                projects = await dataSource.query(
                    `SELECT p.* FROM project p 
                     WHERE p."platformId" = $1 
                     AND (p."ownerId" = $2 OR EXISTS (
                         SELECT 1 FROM project_member pm 
                         WHERE pm."projectId" = p.id AND pm."userId" = $2
                     ))`,
                    [platformId, users[0].id]
                );
            } else {
                projects = await dataSource.query(
                    `SELECT p.* FROM project p 
                     WHERE p.platformId = ? 
                     AND (p.ownerId = ? OR EXISTS (
                         SELECT 1 FROM project_member pm 
                         WHERE pm.projectId = p.id AND pm.userId = ?
                     ))`,
                    [platformId, users[0].id, users[0].id]
                );
            }
            
            if (projects.length === 0) {
                console.log('   ⚠️  No projects found. Creating default project...');
                const projectId = generateId();
                const projectName = `${identity.firstName}'s Project`;
                
                if (dbType === 'POSTGRES') {
                    await dataSource.query(
                        `INSERT INTO project (id, "created", "updated", "displayName", "ownerId", "platformId", "notifyStatus")
                         VALUES ($1, NOW(), NOW(), $2, $3, $4, 'ALWAYS')`,
                        [projectId, projectName, users[0].id, platformId]
                    );
                } else {
                    await dataSource.query(
                        `INSERT INTO project (id, created, updated, displayName, ownerId, platformId, notifyStatus)
                         VALUES (?, datetime('now'), datetime('now'), ?, ?, ?, 'ALWAYS')`,
                        [projectId, projectName, users[0].id, platformId]
                    );
                }
                console.log(`   ✅ Created default project: ${projectName}\n`);
            } else {
                console.log(`   ✅ Found ${projects.length} project(s)\n`);
            }
        }
        
        console.log('✅ All checks passed! User should be able to login now.');
        console.log(`\nSummary:`);
        console.log(`   Email: ${email}`);
        console.log(`   Verified: ✅`);
        console.log(`   User Records: ${users.length}`);
        console.log(`   Status: ACTIVE`);
        
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

fixUserLogin();
