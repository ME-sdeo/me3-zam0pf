# MyElixir Web Frontend

A HIPAA-compliant healthcare data marketplace enabling secure and transparent health data exchange.

## Project Overview

MyElixir Web Frontend is a React-based application that provides a secure platform for health data monetization. Built with enterprise-grade security and compliance features, it enables:

- Secure health data upload and management
- Granular consent control for data sharing
- Real-time marketplace interactions
- FHIR-compliant data visualization
- Blockchain-based transaction tracking

## Prerequisites

- Node.js >= 18.0.0 LTS
- npm >= 8.0.0
- Git >= 2.3.0
- Understanding of HIPAA compliance requirements
- Familiarity with FHIR data standards

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework with concurrent rendering |
| TypeScript | 4.9.0 | Type-safe development |
| Material UI | 5.14.0 | Healthcare-focused component library |
| Redux Toolkit | 1.9.0 | Centralized state management |
| React Query | 4.0.0 | FHIR data fetching and caching |
| React Router | 6.14.0 | Type-safe routing |
| i18next | 23.2.0 | Multi-language support |
| Vite | 4.4.0 | Next-generation build tooling |
| Jest | 29.6.0 | Comprehensive testing framework |
| Cypress | 12.17.0 | End-to-end testing |

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/myelixir/web-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Type checking
npm run type-check

# Lint code
npm run lint
```

### Production Build

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── assets/          # Static assets and images
├── components/      # Reusable UI components
├── config/         # Environment configuration
├── constants/      # Application constants
├── features/       # Feature-based modules
├── hooks/          # Custom React hooks
├── interfaces/     # TypeScript interfaces
├── layouts/        # Page layouts
├── pages/          # Route components
├── services/       # API services
├── store/          # Redux store configuration
├── styles/         # Theme and global styles
├── utils/          # Helper functions
└── tests/          # Test suites
```

## Security Features

### Authentication & Authorization
- Azure AD B2C integration
- Role-based access control (RBAC)
- Multi-factor authentication support
- Session management
- Secure token handling

### Data Protection
- HIPAA-compliant data handling
- End-to-end encryption
- Secure WebSocket connections
- XSS protection
- CSRF token implementation
- Security headers configuration

## Development Guidelines

### Code Style
- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write comprehensive unit tests
- Document components with JSDoc

### State Management
- Use Redux Toolkit for global state
- Implement React Query for server state
- Utilize local state for component-specific data
- Follow immutability principles

### Performance Optimization
- Implement code splitting
- Use React.memo for expensive components
- Optimize bundle size
- Implement proper caching strategies
- Use lazy loading for routes

## Testing Strategy

### Unit Testing
- Jest for component testing
- React Testing Library for integration tests
- 100% coverage for critical paths
- Snapshot testing for UI components

### E2E Testing
- Cypress for end-to-end testing
- Critical user flow coverage
- Cross-browser testing
- Accessibility testing

## Compliance & Accessibility

### HIPAA Compliance
- Secure data transmission
- Audit logging
- Access control
- Data encryption
- Privacy protection

### Accessibility
- WCAG 2.1 Level AA compliance
- Screen reader support
- Keyboard navigation
- High contrast mode
- Focus management

## Environment Configuration

### Development
```env
VITE_API_URL=http://localhost:3000
VITE_AUTH_DOMAIN=dev.myelixir.com
VITE_AUTH_CLIENT_ID=your_client_id
```

### Production
```env
VITE_API_URL=https://api.myelixir.com
VITE_AUTH_DOMAIN=myelixir.com
VITE_AUTH_CLIENT_ID=production_client_id
```

## Contributing

1. Follow the branching strategy
2. Write clear commit messages
3. Include unit tests
4. Update documentation
5. Submit pull requests

## License

Proprietary - MyElixir Healthcare Solutions

## Support

For technical support, please contact:
- Email: support@myelixir.com
- Documentation: https://docs.myelixir.com
- Issue Tracker: https://github.com/myelixir/web-frontend/issues