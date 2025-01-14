import { Knex } from 'knex'; // ^2.4.0
import { 
  CompanyType, 
  CompanyStatus, 
  VerificationStatus,
  ICompany 
} from '../../interfaces/company.interface';

// Seed data for development environment
const SEED_COMPANIES: ICompany[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'PharmaCorp Research',
    email: 'compliance@pharmacorp.com',
    type: CompanyType.PHARMACEUTICAL,
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    profile: {
      description: 'Leading pharmaceutical research company specializing in oncology treatments',
      website: 'https://www.pharmacorp.com',
      address: {
        street: '123 Research Drive',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        postalCode: '02108'
      },
      phone: '+1-617-555-0123',
      researchAreas: ['Oncology', 'Immunotherapy', 'Clinical Trials'],
      certifications: [
        {
          type: 'HIPAA',
          number: 'HIPAA-2023-1234',
          issuedAt: new Date('2023-01-01'),
          expiresAt: new Date('2024-01-01'),
          verificationDocument: 'hipaa_cert_2023.pdf'
        },
        {
          type: 'ISO_27001',
          number: 'ISO27001-2023-5678',
          issuedAt: new Date('2023-02-15'),
          expiresAt: new Date('2024-02-15'),
          verificationDocument: 'iso_cert_2023.pdf'
        }
      ],
      complianceOfficer: 'Jane Smith',
      complianceEmail: 'jane.smith@pharmacorp.com'
    },
    billingInfo: {
      paymentMethod: 'BANK_TRANSFER',
      billingAddress: {
        street: '456 Finance Ave',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        postalCode: '02109'
      },
      taxId: '12-3456789',
      billingEmail: 'billing@pharmacorp.com',
      billingContact: 'John Doe'
    },
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-06-01T00:00:00Z'),
    lastVerifiedAt: new Date('2023-05-15T00:00:00Z')
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'BioTech Innovations',
    email: 'compliance@biotech-innovations.com',
    type: CompanyType.BIOTECH,
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.PENDING,
    profile: {
      description: 'Innovative biotech company focused on genomics research',
      website: 'https://www.biotech-innovations.com',
      address: {
        street: 'Invalidenstraße 115',
        city: 'Berlin',
        state: 'Berlin',
        country: 'Germany',
        postalCode: '10115'
      },
      phone: '+49-30-555-0123',
      researchAreas: ['Genomics', 'Proteomics', 'Bioinformatics'],
      certifications: [
        {
          type: 'GDPR',
          number: 'GDPR-2023-9012',
          issuedAt: new Date('2023-03-01'),
          expiresAt: new Date('2024-03-01'),
          verificationDocument: 'gdpr_cert_2023.pdf'
        }
      ],
      complianceOfficer: 'Hans Mueller',
      complianceEmail: 'hans.mueller@biotech-innovations.com'
    },
    billingInfo: {
      paymentMethod: 'CREDIT_CARD',
      billingAddress: {
        street: 'Friedrichstraße 123',
        city: 'Berlin',
        state: 'Berlin',
        country: 'Germany',
        postalCode: '10117'
      },
      taxId: 'DE123456789',
      billingEmail: 'billing@biotech-innovations.com',
      billingContact: 'Maria Schmidt'
    },
    createdAt: new Date('2023-02-01T00:00:00Z'),
    updatedAt: new Date('2023-06-01T00:00:00Z'),
    lastVerifiedAt: new Date('2023-05-20T00:00:00Z')
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'HealthCare Research Institute',
    email: 'compliance@hcri.org',
    type: CompanyType.RESEARCH,
    status: CompanyStatus.INACTIVE,
    verificationStatus: VerificationStatus.REJECTED,
    profile: {
      description: 'Healthcare research institute specializing in clinical studies',
      website: 'https://www.hcri.org',
      address: {
        street: '789 Research Park',
        city: 'Singapore',
        state: 'Singapore',
        country: 'Singapore',
        postalCode: '138632'
      },
      phone: '+65-6555-0123',
      researchAreas: ['Clinical Studies', 'Public Health', 'Epidemiology'],
      certifications: [],
      complianceOfficer: 'Lee Wei Chen',
      complianceEmail: 'weichen.lee@hcri.org'
    },
    billingInfo: {
      paymentMethod: 'BANK_TRANSFER',
      billingAddress: {
        street: '789 Research Park',
        city: 'Singapore',
        state: 'Singapore',
        country: 'Singapore',
        postalCode: '138632'
      },
      taxId: 'SG123456789',
      billingEmail: 'finance@hcri.org',
      billingContact: 'Tan Mei Ling'
    },
    createdAt: new Date('2023-03-01T00:00:00Z'),
    updatedAt: new Date('2023-06-01T00:00:00Z'),
    lastVerifiedAt: new Date('2023-05-25T00:00:00Z')
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Global Health Providers',
    email: 'compliance@ghp.co.uk',
    type: CompanyType.HEALTHCARE_PROVIDER,
    status: CompanyStatus.SUSPENDED,
    verificationStatus: VerificationStatus.VERIFIED,
    profile: {
      description: 'International healthcare provider network',
      website: 'https://www.ghp.co.uk',
      address: {
        street: '45 Harley Street',
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        postalCode: 'W1G 8AS'
      },
      phone: '+44-20-5555-0123',
      researchAreas: ['Primary Care', 'Telemedicine', 'Healthcare Analytics'],
      certifications: [
        {
          type: 'SOC2',
          number: 'SOC2-2023-3456',
          issuedAt: new Date('2023-04-01'),
          expiresAt: new Date('2024-04-01'),
          verificationDocument: 'soc2_cert_2023.pdf'
        }
      ],
      complianceOfficer: 'Emma Thompson',
      complianceEmail: 'emma.thompson@ghp.co.uk'
    },
    billingInfo: {
      paymentMethod: 'CRYPTO',
      billingAddress: {
        street: '45 Harley Street',
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        postalCode: 'W1G 8AS'
      },
      taxId: 'GB123456789',
      billingEmail: 'accounts@ghp.co.uk',
      billingContact: 'William Brown'
    },
    createdAt: new Date('2023-04-01T00:00:00Z'),
    updatedAt: new Date('2023-06-01T00:00:00Z'),
    lastVerifiedAt: new Date('2023-05-30T00:00:00Z')
  }
];

export async function seed(knex: Knex): Promise<void> {
  // Clear existing entries
  await knex('companies').del();

  // Insert seed entries
  await knex('companies').insert(SEED_COMPANIES.map(company => ({
    ...company,
    profile: JSON.stringify(company.profile),
    billingInfo: JSON.stringify(company.billingInfo)
  })));
}