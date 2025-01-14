import { Knex } from 'knex'; // version: ^2.4.0
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0
import { IUser, UserRole, UserStatus } from '../../interfaces/user.interface';

/**
 * Test users data with HIPAA-compliant profiles for development environment
 * Includes consumers, company representatives, and admin users
 */
const TEST_USERS: IUser[] = [
  // Consumer Users (Data Providers)
  {
    id: uuidv4(),
    email: 'consumer1@example.com',
    role: UserRole.CONSUMER,
    status: UserStatus.ACTIVE,
    profile: {
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: new Date('1985-06-15'),
      phone: '+1-555-0123',
      address: '123 Health St, Medical City, MC 12345'
    },
    authInfo: {
      userId: uuidv4(),
      email: 'consumer1@example.com',
      mfaEnabled: true,
      mfaMethod: 'AUTHENTICATOR',
      lastLogin: new Date()
    },
    preferences: {
      notificationPreferences: ['EMAIL', 'SMS'],
      dataVisibility: ['ANONYMIZED'],
      defaultConsentDuration: 30
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: uuidv4(),
    email: 'consumer2@example.com',
    role: UserRole.CONSUMER,
    status: UserStatus.ACTIVE,
    profile: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      dateOfBirth: new Date('1990-03-21'),
      phone: '+1-555-0124',
      address: '456 Wellness Ave, Medical City, MC 12345'
    },
    authInfo: {
      userId: uuidv4(),
      email: 'consumer2@example.com',
      mfaEnabled: true,
      mfaMethod: 'SMS',
      lastLogin: new Date()
    },
    preferences: {
      notificationPreferences: ['EMAIL'],
      dataVisibility: ['ANONYMIZED', 'AGGREGATED'],
      defaultConsentDuration: 60
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Company Representatives
  {
    id: uuidv4(),
    email: 'company1@healthcorp.com',
    role: UserRole.COMPANY,
    status: UserStatus.ACTIVE,
    profile: {
      firstName: 'Michael',
      lastName: 'Anderson',
      dateOfBirth: new Date('1975-11-30'),
      phone: '+1-555-0125',
      address: '789 Research Blvd, Medical City, MC 12345'
    },
    authInfo: {
      userId: uuidv4(),
      email: 'company1@healthcorp.com',
      mfaEnabled: true,
      mfaMethod: 'AUTHENTICATOR',
      lastLogin: new Date()
    },
    preferences: {
      notificationPreferences: ['EMAIL', 'SMS'],
      dataVisibility: ['FULL'],
      defaultConsentDuration: 90
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Admin User
  {
    id: uuidv4(),
    email: 'admin@myelixir.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    profile: {
      firstName: 'Admin',
      lastName: 'User',
      dateOfBirth: new Date('1980-01-01'),
      phone: '+1-555-0126',
      address: '999 Admin Center, Medical City, MC 12345'
    },
    authInfo: {
      userId: uuidv4(),
      email: 'admin@myelixir.com',
      mfaEnabled: true,
      mfaMethod: 'AUTHENTICATOR',
      lastLogin: new Date()
    },
    preferences: {
      notificationPreferences: ['EMAIL', 'SMS'],
      dataVisibility: ['FULL'],
      defaultConsentDuration: 365
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * Seeds the users table with initial development data
 * Implements HIPAA-compliant test profiles for different user roles
 */
export async function seed(knex: Knex): Promise<void> {
  try {
    // Begin transaction for atomic operation
    await knex.transaction(async (trx) => {
      // Clear existing data
      await trx('users').truncate();

      // Insert test users with HIPAA-compliant profiles
      await trx('users').insert(TEST_USERS.map(user => ({
        ...user,
        // Ensure dates are properly formatted for database
        dateOfBirth: user.profile.dateOfBirth.toISOString(),
        lastLogin: user.authInfo.lastLogin.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        // Stringify JSON fields
        profile: JSON.stringify(user.profile),
        authInfo: JSON.stringify(user.authInfo),
        preferences: JSON.stringify(user.preferences)
      })));

      console.log('Successfully seeded users table with test data');
    });
  } catch (error) {
    console.error('Error seeding users table:', error);
    throw error;
  }
}

export default { seed };