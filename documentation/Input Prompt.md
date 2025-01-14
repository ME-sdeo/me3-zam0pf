```
SYSTEM: You are assisting with the development of MyElixir, an EHR Data Marketplace built on Medplum. The platform enables users to control and monetize their health data.

KEY COMPONENTS:
1. User Management
- Secure authentication with MFA
- Profile management for health data ownership

2. EHR Data (via Medplum)
- FHIR server integration
- HIPAA/GDPR compliant storage
- User data control through FHIR (Fast Healthcare Interoperability Resources) APIs

3. Consent System
- Granular permissions by data type
- Time-based access control
- Consent history tracking

4. Marketplace Features
- Company data access requests
- Real-time bidding system
- User compensation framework to allow users to monetize their data

5. Blockchain (Hyperledger Fabric)
- Transaction tracking
- Smart contracts for consent
- Private data channels

6. Technical Stack
Backend:
- Node.js + Express
- Medplum FHIR integration
- Hyperledger Fabric

Frontend:
- React.js
- FHIR (Fast Healthcare Interoperability Resources) resource visualization

Frontend Capabilities:
- Consumers sharing their health data can register and login to the platform
- Consumers sharing their health data can upload their EHR data
- Consumers sharing their health data can provide consent for their data to be shared with companies
- Consumers sharing their health data can view their health data in the platform
- Consumers sharing their health data can view the data that they have shared with the platform as part of a dashboard
- Consumers sharing their health data can view their compensation history as part of a dashboard


- Companies requesting health data can register and login to the platform
- Companies requesting health data can create requests for health data using various filter criteria, such as demographic and physiological conditions
- Companies submitting a request will also input a number of records needed and the price they are willing to pay for each record
- Companies requesting health data can view the health data that they have received
- Companies can view a dashboard of their existing requests


Database:
- Primary: Medplum FHIR (Fast Healthcare Interoperability Resources)
- Secondary: MongoDB NoSQL

Cloud Infrastructure:
- Microsoft Azure hosting
- Azure Kubernetes Service (AKS)
- Azure Container Registry
- Azure Monitor for observability
- Azure Key Vault for secrets management

APIs:
- REST endpoints
- GraphQL + FHIR (Fast Healthcare Interoperability Resources) APIs

API Capabilities:
Authentication APIs:
- POST /api/auth/register - Register new user (consumer or company)
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- GET /api/auth/verify - Verify user session

Consumer APIs:
- POST /api/consumers/ehr/upload - Upload EHR data
- GET /api/consumers/ehr - Get consumer's health records
- GET /api/consumers/shared-data - Get data shared with companies
- POST /api/consumers/consent - Manage data sharing consent
- GET /api/consumers/compensation - View compensation history

Company APIs:
- POST /api/companies/data-requests - Create new data request
- GET /api/companies/data-requests - Get all company data requests
- GET /api/companies/data-requests/{id} - Get specific request details
- GET /api/companies/received-data - Get received health data
- POST /api/companies/payment - Process payment for data

Data Filtering APIs:
- GET /api/filters/demographic - Get demographic filter options
- GET /api/filters/physiological - Get physiological condition filters
- POST /api/filters/validate - Validate data against filters

Marketplace APIs:
- GET /api/marketplace/active-requests - Get active data requests
- GET /api/marketplace/pricing - Get current market pricing
- POST /api/marketplace/match - Match records to company requests


Background Jobs:
- process-request - Identify consumer health records that satisfy a company's request based on the request's filter criteria
- notify-consumer-request - Notify the consumer that qualifies for the request based on the request's filter criteria that their health data is needed by a company if they have not already provided consent
- notify-consumer-data-shared -  Notify the consumer that qualifies for the request based on the request's filter criteria that their health data has been shared with a company if they have already provided consent
- notify-company-request-met - Notify the company that their request has been met and that the consumer's health data has been shared with them


Infrastructure:
- Docker containers
- Kubernetes orchestration on Azure AKS
- Azure Load Balancer
- Azure Virtual Network

SECURITY REQUIREMENTS:
- End-to-end encryption
- FHIR audit logging
- Regular security testing
- Azure Security Center integration
- Azure DDoS Protection

GOALS:
1. User data control via the frontend 
2. Transparent monetization for the users inputting their health data
3. Secure data sharing with the companies that are requesting the data
4. HIPAA/GDPR compliance
5. Scalable architecture on Azure cloud

INTEGRATION FOCUS:
- Medplum for FHIR operations
- Hyperledger for transactions
- Custom consent engine
    - Granular permissions by data type
    - Time-based access control
    - Consent history tracking
- Real-time marketplace
- Azure services integration

EXPECTED OUTCOME:
Platform will be developed with a react.js frontend and a node.js backend, hosted on Microsoft Azure.

The main goal is that companies can create request for data using various
filter criteria which include physiologial and demographic conditions and
then the platform will automatically validate the existing records that
satitfy the request's filter criteria and will then share that data with the requesting company,
satifying the requesting company's request and providing the user with compensation.
```