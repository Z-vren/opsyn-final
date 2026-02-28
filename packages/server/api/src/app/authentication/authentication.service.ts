import { cryptoUtils } from '@activepieces/server-shared'
import { ActivepiecesError, ApEdition, ApFlagId, assertNotNullOrUndefined, AuthenticationResponse, ErrorCode, isNil, PlatformRole, PlatformWithoutSensitiveData, User, UserIdentity, UserIdentityProvider } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { flagService } from '../flags/flag.service'
import { system } from '../helper/system/system'
import { platformService } from '../platform/platform.service'
import { platformUtils } from '../platform/platform.utils'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'
import { userInvitationsService } from '../user-invitations/user-invitation.service'
import { authenticationUtils } from './authentication-utils'
import { userIdentityService } from './user-identity/user-identity-service'
import { projectPermissionsService } from './project-permissions.service'

export const authenticationService = (log: FastifyBaseLogger) => ({
    async signUp(params: SignUpParams): Promise<AuthenticationResponse> {
        log.info({ email: params.email }, '[signUp] Starting sign-up')
        const edition = system.getEdition()
        const shouldCreateNewPlatform = isNil(params.platformId) || edition === ApEdition.COMMUNITY
        
        if (!shouldCreateNewPlatform && !isNil(params.platformId)) {
            await authenticationUtils.assertEmailAuthIsEnabled({
                platformId: params.platformId,
                provider: params.provider,
            })
            await authenticationUtils.assertDomainIsAllowed({
                email: params.email,
                platformId: params.platformId,
            })
        }
        
        if (shouldCreateNewPlatform) {
            const autoVerify = edition === ApEdition.COMMUNITY || edition === ApEdition.ENTERPRISE
                || params.provider === UserIdentityProvider.GOOGLE
                || params.provider === UserIdentityProvider.JWT
                || params.provider === UserIdentityProvider.SAML
            const mainPlatform = await platformService.getOldestPlatform()
            log.info({ hasMainPlatform: !isNil(mainPlatform) }, '[signUp] Checked for main platform')
            if (isNil(mainPlatform)) {
                log.info('[signUp] No main platform, creating user and platform')
                const userIdentity = await userIdentityService(log).create({
                    ...params,
                    verified: autoVerify,
                })
                return createUserAndPlatform(userIdentity, log)
            }
            log.info({ mainPlatformId: mainPlatform.id }, '[signUp] Main platform exists, creating user on existing platform')
            const userIdentity = await userIdentityService(log).create({
                ...params,
                verified: autoVerify,
            })
            const user = await userService.create({
                identityId: userIdentity.id,
                platformRole: PlatformRole.MEMBER,
                platformId: mainPlatform.id,
            })
            log.info({ userId: user.id }, '[signUp] User created on existing platform')
            await userInvitationsService(log).provisionUserInvitation({
                email: params.email,
            })
            log.info('[signUp] Getting project and token')
            return authenticationUtils.getProjectAndToken({
                userId: user.id,
                platformId: mainPlatform.id,
                projectId: null,
            })
        }

        // At this point, we know platformId is not null because shouldCreateNewPlatform is false
        assertNotNullOrUndefined(params.platformId, 'Platform ID is required for existing platform sign-up')
        const platformId = params.platformId

        await authenticationUtils.assertUserIsInvitedToPlatformOrProject(log, {
            email: params.email,
            platformId,
        })
        const userIdentity = await userIdentityService(log).create({
            ...params,
            verified: true,
        })
        const user = await userService.create({
            identityId: userIdentity.id,
            platformRole: PlatformRole.MEMBER,
            platformId,
        })
        await userInvitationsService(log).provisionUserInvitation({
            email: params.email,
        })

        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId,
            projectId: null,
        })
    },
    async signInWithPassword(params: SignInWithPasswordParams): Promise<AuthenticationResponse> {
        const identity = await userIdentityService(log).verifyIdentityPassword(params)
        const edition = system.getEdition()
        // Single platform model: Always use main platform
        const mainPlatform = await platformService.getOldestPlatform()
        if (isNil(mainPlatform)) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHENTICATION,
                params: {
                    message: 'Main platform not found',
                },
            })
        }
        const platformId = mainPlatform.id
        
        await authenticationUtils.assertEmailAuthIsEnabled({
            platformId,
            provider: UserIdentityProvider.EMAIL,
        })
        await authenticationUtils.assertDomainIsAllowed({
            email: params.email,
            platformId,
        })

        // Community/Enterprise: auto-verify on sign-in if not yet verified
        if (!identity.verified && (edition === ApEdition.COMMUNITY || edition === ApEdition.ENTERPRISE)) {
            await userIdentityService(log).verify(identity.id)
        }
        
        // Get or create user in main platform
        let user = await userService.getOneByIdentityAndPlatform({
            identityId: identity.id,
            platformId,
        })
        
        // If user doesn't exist in main platform, create them
        if (isNil(user)) {
            user = await userService.create({
                identityId: identity.id,
                platformRole: PlatformRole.MEMBER,
                platformId,
            })
        }
        
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId,
            projectId: null,
        })
    },
    async federatedAuthn(params: FederatedAuthnParams): Promise<AuthenticationResponse> {
        const platformId = isNil(params.predefinedPlatformId) ? await getPersonalPlatformIdForFederatedAuthn(params.email, log) : params.predefinedPlatformId
        const userIdentity = await userIdentityService(log).getIdentityByEmail(params.email)

        if (isNil(platformId)) {
            // Single platform model: Use main platform
            const mainPlatform = await platformService.getOldestPlatform()
            if (isNil(mainPlatform)) {
                // Create main platform if it doesn't exist
                if (!isNil(userIdentity)) {
                    return createUserAndPlatform(userIdentity, log)
                }
                return authenticationService(log).signUp({
                    email: params.email,
                    firstName: params.firstName,
                    lastName: params.lastName,
                    newsLetter: params.newsLetter,
                    trackEvents: params.trackEvents,
                    provider: params.provider,
                    platformId: null,
                    password: await cryptoUtils.generateRandomPassword(),
                })
            }
            // Use existing main platform
            if (isNil(userIdentity)) {
                return authenticationService(log).signUp({
                    email: params.email,
                    firstName: params.firstName,
                    lastName: params.lastName,
                    newsLetter: params.newsLetter,
                    trackEvents: params.trackEvents,
                    provider: params.provider,
                    platformId: mainPlatform.id,
                    password: await cryptoUtils.generateRandomPassword(),
                })
            }
            // User exists, ensure they're in main platform
            let user = await userService.getOneByIdentityAndPlatform({
                identityId: userIdentity.id,
                platformId: mainPlatform.id,
            })
            if (isNil(user)) {
                // Create user in main platform
                user = await userService.create({
                    identityId: userIdentity.id,
                    platformRole: PlatformRole.MEMBER,
                    platformId: mainPlatform.id,
                })
            }
            await userInvitationsService(log).provisionUserInvitation({
                email: params.email,
            })
            return authenticationUtils.getProjectAndToken({
                userId: user.id,
                platformId: mainPlatform.id,
                projectId: null,
            })
        }
        if (isNil(userIdentity)) {
            return authenticationService(log).signUp({
                email: params.email,
                firstName: params.firstName,
                lastName: params.lastName,
                newsLetter: params.newsLetter,
                trackEvents: params.trackEvents,
                provider: params.provider,
                platformId,
                password: await cryptoUtils.generateRandomPassword(),
            })
        }
        await userInvitationsService(log).provisionUserInvitation({
            email: params.email,
        })
        const user = await userService.getOneByIdentityAndPlatform({
            identityId: userIdentity.id,
            platformId,
        })
        assertNotNullOrUndefined(user, 'User Identity is found but not the user')
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId,
            projectId: null,
        })
    },
    async switchPlatform(params: SwitchPlatformParams): Promise<AuthenticationResponse> {
        // Single platform model: No platform switching allowed
        // Always use main platform
        const mainPlatform = await platformService.getOldestPlatform()
        assertNotNullOrUndefined(mainPlatform, 'Main platform not found')
        const user = await userService.getOneByIdentityAndPlatform({
            identityId: params.identityId,
            platformId: mainPlatform.id,
        })
        assertNotNullOrUndefined(user, 'User not found on main platform')
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: mainPlatform.id,
            projectId: null,
        })
    },
    async switchProject(params: SwitchProjectParams): Promise<AuthenticationResponse> {
        const project = await projectService.getOneOrThrow(params.projectId)
        const projectPlatform = await platformService.getOneWithPlanOrThrow(project.platformId)
        await assertUserCanSwitchToPlatform(params.currentPlatformId, projectPlatform)
        const user = await getUserForPlatform(params.identityId, projectPlatform)
        
        // Check if user has access to the project (is owner or member)
        const edition = system.getEdition()
        if (edition === ApEdition.COMMUNITY) {
            const role = await projectPermissionsService(log).getRole(params.projectId, user.id)
            if (!role) {
                // User doesn't have access to this project
                throw new ActivepiecesError({
                    code: ErrorCode.AUTHORIZATION,
                    params: {
                        message: 'You do not have access to this project',
                    },
                })
            }
        }
        // For Enterprise/Cloud, RBAC middleware will handle authorization
        
        return authenticationUtils.getProjectAndToken({
            userId: user.id,
            platformId: project.platformId,
            projectId: params.projectId,
        })
    },
})

async function assertUserCanSwitchToPlatform(currentPlatformId: string | null, platform: PlatformWithoutSensitiveData | undefined): Promise<void> {
    if (isNil(platform)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'The user is not a member of the platform',
            },
        })
    }
    const samePlatform = currentPlatformId === platform.id
    const allowToSwitch = !platformUtils.isCustomerOnDedicatedDomain(platform) || samePlatform
    if (!allowToSwitch) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHENTICATION,
            params: {
                message: 'The user is not a member of the platform',
            },
        })
    }
}

async function getUserForPlatform(identityId: string, platform: PlatformWithoutSensitiveData): Promise<User> {
    const user = await userService.getOneByIdentityAndPlatform({
        identityId,
        platformId: platform.id,
    })
    if (isNil(user)) {
        throw new ActivepiecesError({
            code: ErrorCode.AUTHORIZATION,
            params: {
                message: 'User is not member of the platform',
            },
        })
    }
    return user
}

async function createUserAndPlatform(userIdentity: UserIdentity, log: FastifyBaseLogger): Promise<AuthenticationResponse> {
    log.info({ email: userIdentity.email }, '[createUserAndPlatform] Starting')
    const user = await userService.create({
        identityId: userIdentity.id,
        platformRole: PlatformRole.ADMIN,
        platformId: null,
    })
    log.info({ userId: user.id }, '[createUserAndPlatform] User created')
    const platform = await platformService.create({
        ownerId: user.id,
        name: 'OpSyn',
    })
    log.info({ platformId: platform.id }, '[createUserAndPlatform] Platform created')
    await userService.addOwnerToPlatform({
        platformId: platform.id,
        id: user.id,
    })
    const defaultProject = await projectService.create({
        displayName: userIdentity.firstName + '\'s Project',
        ownerId: user.id,
        platformId: platform.id,
    })
    log.info({ projectId: defaultProject.id }, '[createUserAndPlatform] Project created')

    const cloudEdition = system.getEdition()

    switch (cloudEdition) {
        case ApEdition.CLOUD: {
            const { otpService } = await import('../ee/authentication/otp/otp-service')
            const { OtpType } = await import('@activepieces/ee-shared')
            await otpService(log).createAndSend({
                platformId: platform.id,
                email: userIdentity.email,
                type: OtpType.EMAIL_VERIFICATION,
            })
            break
        }
        case ApEdition.COMMUNITY:
        case ApEdition.ENTERPRISE:
            await userIdentityService(log).verify(userIdentity.id)
            break
    }

    await flagService.save({
        id: ApFlagId.USER_CREATED,
        value: true,
    })
    await authenticationUtils.sendTelemetry({
        identity: userIdentity,
        user,
        project: defaultProject,
        log,
    })
    await authenticationUtils.saveNewsLetterSubscriber(user, platform.id, userIdentity, log)

    log.info({ userId: user.id, projectId: defaultProject.id }, '[createUserAndPlatform] Getting project and token')
    return authenticationUtils.getProjectAndToken({
        userId: user.id,
        platformId: platform.id,
        projectId: defaultProject.id,
    })
}

async function getPersonalPlatformIdForFederatedAuthn(email: string, log: FastifyBaseLogger): Promise<string | null> {
    const identity = await userIdentityService(log).getIdentityByEmail(email)
    if (isNil(identity)) {
        return null
    }
    return getPersonalPlatformIdForIdentity(identity.id)
}

async function getPersonalPlatformIdForIdentity(identityId: string): Promise<string | null> {
    // Single platform model: Get the main platform (oldest platform)
    // All users belong to the same platform
    const mainPlatform = await platformService.getOldestPlatform()
    return mainPlatform?.id ?? null
}



type FederatedAuthnParams = {
    email: string
    firstName: string
    lastName: string
    newsLetter: boolean
    trackEvents: boolean
    provider: UserIdentityProvider
    predefinedPlatformId: string | null
}

type SignUpParams = {
    email: string
    firstName: string
    lastName: string
    password: string
    platformId: string | null
    trackEvents: boolean
    newsLetter: boolean
    provider: UserIdentityProvider
}

type SignInWithPasswordParams = {
    email: string
    password: string
    predefinedPlatformId: string | null
}

type SwitchPlatformParams = {
    identityId: string
    platformId: string
}

type SwitchProjectParams = {
    identityId: string
    currentPlatformId: string
    projectId: string
}