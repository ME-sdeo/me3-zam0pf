---
name: Bug Report
about: Report a bug in the MyElixir healthcare data marketplace platform
title: ''
labels: ['bug', 'needs-triage', 'security-review', 'phi-validation-required']
assignees: ['@security-team', '@support-team', '@compliance-team']
---

<!-- IMPORTANT: Ensure NO Protected Health Information (PHI) or Personally Identifiable Information (PII) is included in this report -->

## Bug Description

### Overview
<!-- Provide a clear and concise description of the bug without any PHI/PII -->

### Expected Behavior
<!-- What should happen according to system specifications -->

### Current Behavior
<!-- What is happening with specific error details -->

### Severity Level
<!-- Select the appropriate severity level based on impact -->
- [ ] Critical
  - System downtime affecting healthcare data access
  - Security breach with potential PHI/PII exposure
  - FHIR data loss or corruption
  - HIPAA/GDPR compliance violation
- [ ] High
  - Major FHIR functionality broken
  - Significant performance degradation affecting data access
  - Data integrity issues in health records
  - Potential compliance risks
- [ ] Medium
  - Minor functionality issues not affecting PHI/PII
  - UI/UX problems in data visualization
  - Non-critical FHIR validation errors
  - Performance warnings within SLA
- [ ] Low
  - Cosmetic issues not affecting functionality
  - Documentation errors
  - Minor UI inconsistencies
  - Non-critical warnings

## Environment

### Platform Component
<!-- Select the affected component -->
- [ ] Consumer Portal
- [ ] Company Portal
- [ ] Backend Services
- [ ] FHIR Integration
- [ ] Blockchain Services
- [ ] Infrastructure

### Environment Type
- [ ] Production
- [ ] Staging
- [ ] Development

### Browser/Version
<!-- For frontend issues only -->
<!-- Example: Chrome 96.0.4664.93 -->

## Security Impact

### PHI/PII Exposure
<!-- Detailed assessment of any potential protected health information exposure -->
- [ ] No PHI/PII exposure confirmed
- [ ] Potential exposure (detail mitigation steps taken)
- [ ] Unknown (requires immediate security team review)

### Compliance Impact
<!-- Analysis of HIPAA/GDPR compliance implications -->
- [ ] No compliance impact
- [ ] Potential compliance risk (specify)
- [ ] Direct compliance violation (detail incident response)

### Data Integrity
<!-- Impact assessment on FHIR data accuracy and integrity -->
- [ ] No data integrity impact
- [ ] Potential data corruption (specify affected resources)
- [ ] Confirmed data integrity issue (detail scope)

## Reproduction Steps

### Prerequisites
<!-- Required setup or conditions using sanitized test data -->
1. 

### Steps to Reproduce
<!-- Detailed steps using sanitized test data -->
1. 
2. 
3. 

### Sample Data
<!-- IMPORTANT: Include ONLY sanitized test data with explicit confirmation of no PHI/PII -->
<!-- Example: Use synthetic FHIR resources from test environment -->
```json
{
  "resourceType": "Patient",
  "id": "test-patient-id",
  "active": true
}
```

## Technical Details

### Error Messages
<!-- Include sanitized error logs or messages -->
```
```

### Stack Trace
<!-- Include sanitized stack trace if applicable -->
```
```

### Related Components
<!-- List other affected system components and their interactions -->
- Primary Component:
- Dependent Services:
- Affected Integrations:

### Performance Impact
<!-- Detail any performance degradation -->
- Response Time Impact:
- Resource Utilization:
- User Experience Impact:

<!-- Final Checklist -->
- [ ] I have confirmed this report contains NO PHI/PII
- [ ] I have sanitized all technical details and logs
- [ ] I have classified the security impact appropriately
- [ ] I have included all relevant technical details
- [ ] I have specified the correct severity level