# Core resource variables
variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where monitoring resources will be created"
}

variable "location" {
  type        = string
  description = "Azure region where monitoring resources will be deployed"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g., prod, staging, dev) for resource naming and configuration"
}

# Log Analytics configuration
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain logs (HIPAA requires minimum 7 years - 2555 days)"
  default     = 2555 # 7 years retention for HIPAA compliance
}

# Container monitoring
variable "enable_container_insights" {
  type        = bool
  description = "Flag to enable Container Insights for AKS monitoring and performance tracking"
  default     = true
}

# Alert thresholds for security monitoring
variable "alert_thresholds" {
  type = map(object({
    threshold    = number
    window_size  = string
    severity     = number
  }))
  description = "Map of monitoring alert thresholds for WAF, API Gateway, Authentication, and Database metrics"
  default = {
    waf_blocked_requests = {
      threshold    = 100  # >100 blocked requests/min
      window_size  = "PT1M"
      severity     = 2
    }
    api_gateway_requests = {
      threshold    = 1000 # >1000 requests/min/IP
      window_size  = "PT1M"
      severity     = 2
    }
    auth_failures = {
      threshold    = 5    # >5 failures/10 min/user
      window_size  = "PT10M"
      severity     = 1
    }
    database_query_performance = {
      threshold    = 95   # 95th percentile query duration
      window_size  = "PT5M"
      severity     = 2
    }
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for monitoring resources including compliance and environment metadata"
  default = {
    "compliance:hipaa" = "true"
    "compliance:gdpr"  = "true"
    "data:retention"   = "7years"
    "security:level"   = "high"
    "monitoring:type"  = "full"
  }
}