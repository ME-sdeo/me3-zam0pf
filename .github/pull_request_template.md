# Pull Request Template

> ⚠️ WARNING: Ensure no PHI/PII is included in this pull request description or comments

## PR Type
- [ ] Feature Implementation
- [ ] Bug Fix
- [ ] Security Enhancement
- [ ] Performance Improvement
- [ ] Documentation Update
- [ ] Dependency Update

## Description

### Changes
<!-- Provide a detailed description of the changes made in this PR -->

### Related Issues
<!-- Link to related issues or feature requests using #issue_number -->

## Security Checklist

### PHI/PII Impact
- [ ] No PHI/PII data is affected by these changes
- [ ] PHI/PII data is affected (Security team review required)
- [ ] Data encryption requirements are satisfied
- [ ] Access controls have been verified

### HIPAA Compliance
- [ ] Changes maintain HIPAA compliance
- [ ] Security controls are properly implemented
- [ ] Audit logging is maintained
- [ ] Data retention policies are followed

### GDPR Compliance
- [ ] Changes comply with GDPR requirements
- [ ] Data privacy controls are implemented
- [ ] User consent mechanisms are preserved
- [ ] Data portability is maintained

### Security Review
- [ ] Security vulnerabilities assessment completed
- [ ] No new security risks introduced
- [ ] Security testing performed
- [ ] Security documentation updated

## Technical Implementation

### Architecture Changes
- [ ] No architecture changes
- [ ] Architecture changes documented
- [ ] Impact on other components assessed
- [ ] Tech lead review completed

### Database Changes
- [ ] No database changes
- [ ] Database migrations included
- [ ] Data integrity verified
- [ ] Backup procedures updated

### API Changes
- [ ] No API changes
- [ ] API documentation updated
- [ ] Backward compatibility maintained
- [ ] API versioning requirements met

### Performance Impact
- [ ] No performance impact
- [ ] Performance testing completed
- [ ] Meets <2s response time requirement
- [ ] Maintains 99.9% uptime target

## Testing

### Unit Tests
- [ ] New unit tests added
- [ ] Existing tests updated
- [ ] Test coverage maintained
- [ ] All tests passing

### Integration Tests
- [ ] Integration tests updated
- [ ] End-to-end scenarios covered
- [ ] FHIR validation tests included
- [ ] Cross-service interactions tested

### Security Tests
- [ ] Security scan completed
- [ ] Penetration testing performed
- [ ] Vulnerability assessment done
- [ ] Security controls verified

### Performance Tests
- [ ] Load testing completed
- [ ] Stress testing performed
- [ ] Response time verified
- [ ] Resource utilization checked

## Deployment

### Migration Steps
- [ ] Deployment steps documented
- [ ] Configuration changes listed
- [ ] Environment variables updated
- [ ] Dependencies verified

### Rollback Plan
- [ ] Rollback steps documented
- [ ] Data migration reversible
- [ ] Previous version verified
- [ ] Recovery points identified

### Monitoring Plan
- [ ] Monitoring metrics defined
- [ ] Alert thresholds set
- [ ] Logging implemented
- [ ] Health checks configured

<!-- 
REVIEWER CHECKLIST:
- [ ] Security team review required for PHI/PII changes
- [ ] Compliance team verification for HIPAA/GDPR requirements
- [ ] Performance team validation for system metrics
- [ ] Tech lead approval for architecture changes
-->