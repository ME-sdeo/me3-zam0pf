# Project and Environment Configuration
variable "project_name" {
  description = "Name of the project used for resource naming"
  type        = string
  
  validation {
    condition     = length(var.project_name) <= 24
    error_message = "Project name must be 24 characters or less"
  }
}

variable "environment" {
  description = "Deployment environment (prod, staging, dev)"
  type        = string
  
  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "Environment must be one of: prod, staging, dev"
  }
}

variable "location" {
  description = "Azure region for resource deployment"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group where security resources will be deployed"
  type        = string
}

# Key Vault Configuration
variable "key_vault_sku" {
  description = "SKU name for Azure Key Vault (Premium required for HSM support)"
  type        = string
  default     = "Premium"
  
  validation {
    condition     = contains(["Premium", "Standard"], var.key_vault_sku)
    error_message = "Key Vault SKU must be either Premium or Standard"
  }
}

variable "key_rotation_days" {
  description = "Number of days before automatic key rotation"
  type        = number
  default     = 90
  
  validation {
    condition     = var.key_rotation_days >= 30 && var.key_rotation_days <= 365
    error_message = "Key rotation period must be between 30 and 365 days"
  }
}

# WAF and Network Security Configuration
variable "waf_policy_mode" {
  description = "WAF policy enforcement mode (Detection or Prevention)"
  type        = string
  default     = "Prevention"
  
  validation {
    condition     = contains(["Detection", "Prevention"], var.waf_policy_mode)
    error_message = "WAF policy mode must be either Detection or Prevention"
  }
}

variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access Key Vault"
  type        = list(string)
  default     = []
}

# Security Monitoring and Alert Configuration
variable "alert_thresholds" {
  description = "Map of security alert thresholds"
  type        = map(number)
  default = {
    failed_key_vault_operations    = 10
    waf_blocked_requests          = 100
    suspicious_operations_per_minute = 50
  }
}