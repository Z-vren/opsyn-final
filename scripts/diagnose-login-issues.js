#!/usr/bin/env node

/**
 * Comprehensive diagnostic script for login and project visibility issues
 * 
 * Issues being diagnosed:
 * 1. Users cannot sign in even with correct password
 * 2. Projects disappear after sign-in
 */

const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    console.error('Usage: node diagnose-login-issues.js <email>');
    process.exit(1);
}

async function diagnoseLoginIssues() {
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
        
        // ============================================
        // DIAGNOSIS 1: Check User Identity
        // ============================================
        console.log('='.repeat(60));
        console.log('DIAGNOSIS 1: User Identity Status');
        console.log('='.repeat(60));
        
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
            console.error(`❌ ISSUE FOUND: User identity not found`);
            console.error(`   Email: ${email}`);
            console.error(`   Solution: User needs to sign up first\n`);
            process.exit(1);
        }
        
        const identity = userIdentity[0];
        console.log(`✅ User Identity Found:`);
        console.log(`   Email: ${identity.email}`);
        console.log(`   Verified: ${identity.verified ? '✅ YES' : '❌ NO'}`);
        console.log(`   Provider: ${identity.provider}`);
        console.log(`   ID: ${identity.id}`);
        
        if (!identity.verified) {
            console.log(`\n⚠️  ISSUE FOUND: Email not verified`);
            console.log(`   This will prevent login even with correct password`);
            console.log(`   Fix: Set verified = true in user_identity table\n`);
        }
        
        // ============================================
        // DIAGNOSIS 2: Check User Records
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('DIAGNOSIS 2: User Records (Platform Association)');
        console.log('='.repeat(60));
        
        let users;
        if (dbType === 'POSTGRES') {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name, p."ownerId" as platform_owner_id
                 FROM "user" u 
                 LEFT JOIN platform p ON u."platformId" = p.id 
                 WHERE u."identityId" = $1
                 ORDER BY u."created"`,
                [identity.id]
            );
        } else {
            users = await dataSource.query(
                `SELECT u.*, p.id as platform_id, p.name as platform_name, p.ownerId as platform_owner_id
                 FROM user u 
                 LEFT JOIN platform p ON u.platformId = p.id 
                 WHERE u.identityId = ?
                 ORDER BY u.created`,
                [identity.id]
            );
        }
        
        if (users.length === 0) {
            console.error(`❌ CRITICAL ISSUE: No user records found!`);
            console.error(`   The user identity exists but there's no user record in the user table.`);
            console.error(`   This will prevent login because getPersonalPlatformIdForIdentity returns null.`);
            console.error(`   Fix: Create a user record with platform association\n`);
        } else {
            console.log(`✅ Found ${users.length} user record(s):`);
            users.forEach((user, index) => {
                console.log(`\n   User Record ${index + 1}:`);
                console.log(`      User ID: ${user.id}`);
                console.log(`      Status: ${user.status || 'ACTIVE'}`);
                console.log(`      Platform Role: ${user.platformRole}`);
                console.log(`      Platform ID: ${user.platformId || '(none)'}`);
                console.log(`      Platform Name: ${user.platform_name || '(none)'}`);
                
                if (user.status !== 'ACTIVE') {
                    console.log(`      ⚠️  ISSUE: User status is ${user.status} (should be ACTIVE)`);
                }
                
                if (!user.platformId) {
                    console.log(`      ⚠️  ISSUE: User has no platformId`);
                }
            });
        }
        
        // ============================================
        // DIAGNOSIS 3: Platform Selection Logic
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('DIAGNOSIS 3: Platform Selection (Login Flow)');
        console.log('='.repeat(60));
        console.log('Checking which platform would be selected during login...\n');
        
        // Simulate getPersonalPlatformIdForIdentity logic
        const activeUsers = users.filter(u => u.status === 'ACTIVE' && u.platformId);
        
        if (activeUsers.length === 0) {
            console.error(`❌ CRITICAL ISSUE: No active users with platformId found`);
            console.error(`   getPersonalPlatformIdForIdentity will return null`);
            console.error(`   This causes: "No platform found for identity" error\n`);
        } else {
            console.log(`Checking projects for each active user...\n`);
            
            for (const user of activeUsers) {
                // Check if user has projects (simulating userHasProjects)
                let ownedProjects, memberProjects;
                
                if (dbType === 'POSTGRES') {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE "ownerId" = $1 AND "platformId" = $2 AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE "userId" = $1 AND "platformId" = $2`,
                        [user.id, user.platformId]
                    );
                } else {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE ownerId = ? AND platformId = ? AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE userId = ? AND platformId = ?`,
                        [user.id, user.platformId]
                    );
                }
                
                const ownedCount = parseInt(ownedProjects[0].count);
                const memberCount = parseInt(memberProjects[0].count);
                const hasProjects = ownedCount > 0 || memberCount > 0;
                
                console.log(`   User ${user.id} (Platform: ${user.platform_name || user.platformId}):`);
                console.log(`      Owned Projects: ${ownedCount}`);
                console.log(`      Member Projects: ${memberCount}`);
                console.log(`      Has Projects: ${hasProjects ? '✅ YES' : '❌ NO'}`);
                
                if (!hasProjects) {
                    console.log(`      ⚠️  ISSUE: This platform will be SKIPPED during login`);
                    console.log(`         Because listPlatformsForIdentityWithAtleastProject filters out platforms without projects`);
                }
            }
            
            const platformsWithProjects = activeUsers.filter(async (user) => {
                let ownedProjects, memberProjects;
                if (dbType === 'POSTGRES') {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE "ownerId" = $1 AND "platformId" = $2 AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE "userId" = $1 AND "platformId" = $2`,
                        [user.id, user.platformId]
                    );
                } else {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE ownerId = ? AND platformId = ? AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE userId = ? AND platformId = ?`,
                        [user.id, user.platformId]
                    );
                }
                return parseInt(ownedProjects[0].count) > 0 || parseInt(memberProjects[0].count) > 0;
            });
            
            // Check all users synchronously
            const platformsWithProjectsResults = [];
            for (const user of activeUsers) {
                let ownedProjects, memberProjects;
                if (dbType === 'POSTGRES') {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE "ownerId" = $1 AND "platformId" = $2 AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE "userId" = $1 AND "platformId" = $2`,
                        [user.id, user.platformId]
                    );
                } else {
                    ownedProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project 
                         WHERE ownerId = ? AND platformId = ? AND deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                    memberProjects = await dataSource.query(
                        `SELECT COUNT(*) as count FROM project_member 
                         WHERE userId = ? AND platformId = ?`,
                        [user.id, user.platformId]
                    );
                }
                const hasProjects = parseInt(ownedProjects[0].count) > 0 || parseInt(memberProjects[0].count) > 0;
                if (hasProjects) {
                    platformsWithProjectsResults.push(user);
                }
            }
            
            if (platformsWithProjectsResults.length === 0) {
                console.log(`\n❌ CRITICAL ISSUE: No platforms with projects found!`);
                console.log(`   getPersonalPlatformIdForIdentity will return null`);
                console.log(`   This causes: "No platform found for identity" error during login`);
                console.log(`   Fix: Ensure at least one user has projects (owned or member)\n`);
            } else {
                console.log(`\n✅ Platform that would be selected: ${platformsWithProjectsResults[0].platform_name || platformsWithProjectsResults[0].platformId}`);
            }
        }
        
        // ============================================
        // DIAGNOSIS 4: Project Visibility
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('DIAGNOSIS 4: Project Visibility (Why Projects Disappear)');
        console.log('='.repeat(60));
        
        if (users.length > 0) {
            for (const user of users.filter(u => u.platformId)) {
                console.log(`\nChecking projects for User ${user.id} (Platform: ${user.platform_name || user.platformId}):`);
                
                // Get all projects in the platform
                let allPlatformProjects;
                if (dbType === 'POSTGRES') {
                    allPlatformProjects = await dataSource.query(
                        `SELECT id, "displayName", "ownerId", "platformId", deleted
                         FROM project 
                         WHERE "platformId" = $1 AND deleted IS NULL`,
                        [user.platformId]
                    );
                } else {
                    allPlatformProjects = await dataSource.query(
                        `SELECT id, displayName, ownerId, platformId, deleted
                         FROM project 
                         WHERE platformId = ? AND deleted IS NULL`,
                        [user.platformId]
                    );
                }
                
                console.log(`   Total projects in platform: ${allPlatformProjects.length}`);
                
                // Get projects user owns
                const ownedProjects = allPlatformProjects.filter(p => p.ownerId === user.id);
                console.log(`   Projects user owns: ${ownedProjects.length}`);
                
                // Get projects user is member of
                let memberProjects;
                if (dbType === 'POSTGRES') {
                    memberProjects = await dataSource.query(
                        `SELECT pm."projectId", p."displayName"
                         FROM project_member pm
                         INNER JOIN project p ON pm."projectId" = p.id
                         WHERE pm."userId" = $1 AND pm."platformId" = $2 AND p.deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                } else {
                    memberProjects = await dataSource.query(
                        `SELECT pm.projectId, p.displayName
                         FROM project_member pm
                         INNER JOIN project p ON pm.projectId = p.id
                         WHERE pm.userId = ? AND pm.platformId = ? AND p.deleted IS NULL`,
                        [user.id, user.platformId]
                    );
                }
                
                console.log(`   Projects user is member of: ${memberProjects.length}`);
                
                // Check if user is privileged
                const isPrivileged = user.platformRole === 'ADMIN' || user.platformRole === 'OPERATOR';
                console.log(`   User role: ${user.platformRole} (Privileged: ${isPrivileged ? 'YES' : 'NO'})`);
                
                if (isPrivileged) {
                    console.log(`   ✅ User can see ALL ${allPlatformProjects.length} projects in platform`);
                } else {
                    const visibleProjects = [...new Set([
                        ...ownedProjects.map(p => p.id),
                        ...memberProjects.map(p => p.projectId)
                    ])];
                    console.log(`   ✅ User can see ${visibleProjects.length} projects`);
                    
                    if (allPlatformProjects.length > visibleProjects.length) {
                        console.log(`   ⚠️  ISSUE: ${allPlatformProjects.length - visibleProjects.length} projects are NOT visible`);
                        console.log(`      Reason: User is not owner and not a member`);
                        console.log(`      Projects not visible:`);
                        allPlatformProjects.forEach(p => {
                            if (!visibleProjects.includes(p.id)) {
                                console.log(`         - ${p.displayName || p.id} (Owner: ${p.ownerId})`);
                            }
                        });
                    }
                }
            }
        }
        
        // ============================================
        // SUMMARY
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        
        const issues = [];
        
        if (!identity.verified) {
            issues.push('Email not verified');
        }
        
        if (users.length === 0) {
            issues.push('No user records found');
        }
        
        const inactiveUsers = users.filter(u => u.status !== 'ACTIVE');
        if (inactiveUsers.length > 0) {
            issues.push(`${inactiveUsers.length} inactive user(s)`);
        }
        
        const usersWithoutPlatform = users.filter(u => !u.platformId);
        if (usersWithoutPlatform.length > 0) {
            issues.push(`${usersWithoutPlatform.length} user(s) without platformId`);
        }
        
        if (issues.length === 0) {
            console.log('✅ No critical issues found. User should be able to login.');
        } else {
            console.log('⚠️  Issues found:');
            issues.forEach(issue => console.log(`   - ${issue}`));
            console.log('\nRun fix-user-login.js to automatically fix these issues.');
        }
        
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

diagnoseLoginIssues();
