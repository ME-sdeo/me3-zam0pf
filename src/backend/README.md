# MyElixir Backend Service

Enterprise-grade healthcare data marketplace backend service implementing HIPAA-compliant data exchange.

## Prerequisites

- Node.js >= 18.0.0 LTS
- Docker >= 20.10.0 and Docker Compose >= 2.0.0
- MongoDB >= 6.0.0
- Redis >= 7.0.0
- Azure CLI >= 2.40.0
- Kubernetes CLI >= 1.25.0
- Medplum CLI >= 2.0.0
- Hyperledger Fabric SDK >= 2.2.0

## Technology Stack

### Core Technologies
- Node.js 18.x LTS with TypeScript 4.9+
- Express.js 4.18+ for API routing
- Medplum SDK 2.0+ for FHIR integration
- Hyperledger Fabric SDK 2.2+ for blockchain
- Jest 29+ with Supertest for testing

### Data Storage
- MongoDB 6.0+ for metadata storage
- Redis 7.0+ for caching

### Cloud Services
- Azure Kubernetes Service (AKS)
- Azure AD B2C for authentication
- Azure Monitor for observability
- Azure Key Vault for secrets

## Project Structure

```
src/
├── api/            # RESTful API routes, controllers, and middleware
├── services/       # Core business logic and service implementations
├── models/         # Data models, schemas, and type definitions
├── blockchain/     # Hyperledger Fabric integration and smart contracts
├── fhir/           # FHIR resource handling and validation
├── config/         # Environment-specific configurations
├── utils/          # Shared utilities and helper functions
└── tests/          # Unit, integration, and e2e tests
```

## Security Features

- OAuth 2.0 + PKCE authentication flow
- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC)
- Field-level encryption for sensitive data
- HIPAA-compliant data handling
- Comprehensive audit logging
- Rate limiting and DDoS protection
- TLS 1.3 encryption in transit

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/myelixir/backend.git
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment template:
```bash
cp .env.example .env
```

4. Start development environment:
```bash
docker-compose up -d
npm run dev
```

## Environment Configuration

Configure the following environment variables in `.env`:

```
# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Authentication
AZURE_AD_B2C_TENANT=
AZURE_AD_B2C_CLIENT_ID=
AZURE_AD_B2C_CLIENT_SECRET=

# FHIR Integration
MEDPLUM_API_URL=
MEDPLUM_CLIENT_ID=
MEDPLUM_CLIENT_SECRET=

# Blockchain
HYPERLEDGER_CONNECTION_PROFILE=
HYPERLEDGER_CHANNEL_NAME=
HYPERLEDGER_CHAINCODE_NAME=

# Storage
MONGODB_URI=
REDIS_URL=

# Monitoring
AZURE_MONITOR_CONNECTION_STRING=
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production TypeScript
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Docker Support

Build the container:
```bash
docker build -t myelixir-backend .
```

Run with Docker Compose:
```bash
docker-compose up -d
```

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Deployment

### Development
```bash
npm run deploy:dev
```

### Staging
```bash
npm run deploy:staging
```

### Production
```bash
npm run deploy:prod
```

## API Documentation

API documentation is available at `/api/docs` when running in development mode.

## Monitoring and Logging

- Application metrics: Azure Application Insights
- Log aggregation: Azure Log Analytics
- Distributed tracing: Azure Monitor
- Performance monitoring: Azure Monitor

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

Copyright © 2023 MyElixir. All rights reserved.