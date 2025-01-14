import { UUID } from 'crypto';
import { PublicClientApplication, Configuration, AuthorizationUrlRequest } from '@azure/msal-node'; // version: ^1.14.6
import bcrypt from 'bcryptjs'; // version: ^2.4.3
import { RateLimiterMemory } from 'rate-limiter-flexible'; // version: ^2.4.1
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0

import { IUser, UserRole, UserStatus, IUserProfile, IUserAuthInfo, IUserPreferences } from '../interfaces/user.interface';
import UserModel from '../models/user.model';
import { AuthenticationError } from '../utils/error.util';
import { logger, createLogMetadata } from '../utils/logger.util';

// Security configuration constants
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_HOURS = 24;
const IP_RATE_LIMIT = 100;
const IP_RATE_WINDOW = 3600;

/**
 * Enhanced UserService with HIPAA compliance and security features
 */
export class UserService {
    private readonly azureConfig: Configuration;
    private readonly msalClient: PublicClientApplication;
    private readonly rateLimiter: RateLimiterMemory;

    constructor() {
        // Initialize Azure AD B2C configuration
        this.azureConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID!,
                authority: process.env.AZURE_AUTHORITY!,
                clientSecret: process.env.AZURE_CLIENT_SECRET!,
                knownAuthorities: [process.env.AZURE_KNOWN_AUTHORITIES!]
            }
        };

        // Initialize MSAL client
        this.msalClient = new PublicClientApplication(this.azureConfig);

        // Initialize rate limiter
        this.rateLimiter = new RateLimiterMemory({
            points: IP_RATE_LIMIT,
            duration: IP_RATE_WINDOW
        });
    }

    /**
     * Creates a new user with enhanced security validation
     * @param createUserPayload User creation payload
     * @param ipAddress Client IP address for rate limiting
     * @returns Created user object
     */
    public async createUser(
        createUserPayload: {
            email: string;
            password: string;
            role: UserRole;
            profile: IUserProfile;
            preferences: IUserPreferences;
        },
        ipAddress: string
    ): Promise<IUser> {
        try {
            // Rate limiting check
            await this.rateLimiter.consume(ipAddress);

            // Validate email format and domain
            if (!this.validateEmail(createUserPayload.email)) {
                throw new AuthenticationError(
                    'AUTH_001',
                    { email: createUserPayload.email },
                    uuidv4()
                );
            }

            // Check if email already exists
            const existingUser = await UserModel.findByEmail(createUserPayload.email);
            if (existingUser) {
                throw new AuthenticationError(
                    'AUTH_002',
                    { email: createUserPayload.email },
                    uuidv4()
                );
            }

            // Create Azure AD B2C user
            const azureUser = await this.createAzureADUser(createUserPayload);

            // Hash password with strong encryption
            const hashedPassword = await bcrypt.hash(createUserPayload.password, BCRYPT_ROUNDS);

            // Prepare user object with HIPAA-compliant fields
            const user: IUser = {
                id: uuidv4() as UUID,
                email: createUserPayload.email.toLowerCase(),
                role: createUserPayload.role,
                status: UserStatus.PENDING_VERIFICATION,
                profile: createUserPayload.profile,
                authInfo: {
                    userId: azureUser.id as UUID,
                    email: createUserPayload.email,
                    mfaEnabled: true,
                    mfaMethod: 'SMS',
                    lastLogin: new Date()
                },
                preferences: createUserPayload.preferences,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Create user in database with audit trail
            const createdUser = await UserModel.create(user);

            // Log user creation with security metadata
            logger.info('User created successfully', createLogMetadata({
                action: 'user.create',
                userId: createdUser.id,
                userRole: createdUser.role,
                ipAddress
            }));

            return createdUser;
        } catch (error) {
            logger.error('User creation failed', createLogMetadata({
                error: error.message,
                email: createUserPayload.email,
                ipAddress
            }));
            throw error;
        }
    }

    /**
     * Retrieves user by ID with security validation
     * @param userId User ID to retrieve
     * @param requestContext Security context information
     * @returns User object if found
     */
    public async getUserById(
        userId: UUID,
        requestContext: { ipAddress: string; userRole: UserRole }
    ): Promise<IUser> {
        try {
            // Rate limiting check
            await this.rateLimiter.consume(requestContext.ipAddress);

            // Validate user ID format
            if (!this.validateUUID(userId)) {
                throw new AuthenticationError(
                    'AUTH_001',
                    { userId },
                    uuidv4()
                );
            }

            // Retrieve user with role-based access control
            const user = await UserModel.findOne({ id: userId });
            if (!user) {
                throw new AuthenticationError(
                    'AUTH_002',
                    { userId },
                    uuidv4()
                );
            }

            // Verify access permissions
            if (!this.canAccessUser(requestContext.userRole, user.role)) {
                throw new AuthenticationError(
                    'AUTH_003',
                    { userId, requestorRole: requestContext.userRole },
                    uuidv4()
                );
            }

            // Log access with security metadata
            logger.info('User retrieved successfully', createLogMetadata({
                action: 'user.read',
                userId,
                accessorRole: requestContext.userRole,
                ipAddress: requestContext.ipAddress
            }));

            return user;
        } catch (error) {
            logger.error('User retrieval failed', createLogMetadata({
                error: error.message,
                userId,
                ipAddress: requestContext.ipAddress
            }));
            throw error;
        }
    }

    /**
     * Updates user profile with security validation
     * @param userId User ID to update
     * @param updateData Update payload
     * @param requestContext Security context information
     * @returns Updated user object
     */
    public async updateUser(
        userId: UUID,
        updateData: Partial<IUser>,
        requestContext: { ipAddress: string; userRole: UserRole }
    ): Promise<IUser> {
        try {
            // Rate limiting check
            await this.rateLimiter.consume(requestContext.ipAddress);

            // Validate update permissions
            const user = await this.getUserById(userId, requestContext);
            if (!this.canModifyUser(requestContext.userRole, user.role)) {
                throw new AuthenticationError(
                    'AUTH_004',
                    { userId, requestorRole: requestContext.userRole },
                    uuidv4()
                );
            }

            // Update user with audit trail
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                {
                    ...updateData,
                    updatedAt: new Date()
                },
                { new: true }
            );

            // Log update with security metadata
            logger.info('User updated successfully', createLogMetadata({
                action: 'user.update',
                userId,
                updaterRole: requestContext.userRole,
                ipAddress: requestContext.ipAddress
            }));

            return updatedUser!;
        } catch (error) {
            logger.error('User update failed', createLogMetadata({
                error: error.message,
                userId,
                ipAddress: requestContext.ipAddress
            }));
            throw error;
        }
    }

    // Private helper methods
    private async createAzureADUser(userData: any): Promise<any> {
        // Implementation for Azure AD B2C user creation
        // This is a placeholder for the actual implementation
        return { id: uuidv4() };
    }

    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private validateUUID(uuid: UUID): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid.toString());
    }

    private canAccessUser(accessorRole: UserRole, targetRole: UserRole): boolean {
        if (accessorRole === UserRole.ADMIN) return true;
        if (accessorRole === UserRole.SYSTEM) return true;
        return accessorRole === targetRole;
    }

    private canModifyUser(modifierRole: UserRole, targetRole: UserRole): boolean {
        if (modifierRole === UserRole.ADMIN) return true;
        if (modifierRole === UserRole.SYSTEM) return true;
        return modifierRole === targetRole;
    }
}

export default new UserService();