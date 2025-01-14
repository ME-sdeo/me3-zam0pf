# Core project variables for MyElixir healthcare data marketplace infrastructure
# Terraform version: ~> 1.0

# Project identification
variable "project_name" {
  type        = string
  description = "Name of the MyElixir healthcare data marketplace project used for resource naming"
  default     = "myelixir"
}

# Environment selection with validation
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Regional configuration
variable "primary_location" {
  type        = string
  description = "Primary Azure region for resource deployment"
  default     = "eastus"
}

variable "secondary_location" {
  type        = string
  description = "Secondary Azure region for disaster recovery"
  default     = "westus"
}

# Network configuration
variable "network_address_space" {
  type        = list(string)
  description = "CIDR ranges for virtual network address spaces"
  default     = ["10.0.0.0/16", "10.1.0.0/16"]
}

# AKS cluster configuration
variable "aks_node_count" {
  type        = number
  description = "Default number of nodes in AKS cluster"
  default     = 3
  validation {
    condition     = var.aks_node_count >= 3
    error_message = "AKS cluster must have at least 3 nodes for high availability."
  }
}

variable "aks_node_size" {
  type        = string
  description = "VM size for AKS nodes"
  default     = "Standard_D4s_v3"
  validation {
    condition     = can(regex("^Standard_D[2-8]s_v3$", var.aks_node_size))
    error_message = "AKS node size must be a valid D-series v3 instance type."
  }
}

# Monitoring and observability
variable "enable_monitoring" {
  type        = bool
  description = "Flag to enable Azure Monitor and Log Analytics"
  default     = true
}

# Data protection
variable "enable_backup" {
  type        = bool
  description = "Flag to enable Azure Backup for data protection"
  default     = true
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Common resource tags for cost tracking and organization"
  default = {
    Project     = "MyElixir"
    Compliance  = "HIPAA"
    CostCenter  = "Healthcare"
    Application = "DataMarketplace"
  }
}

# HIPAA compliance configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable encryption at rest for all applicable resources"
  default     = true
}

variable "enable_audit_logging" {
  type        = bool
  description = "Enable comprehensive audit logging for HIPAA compliance"
  default     = true
}

# High availability configuration
variable "enable_zone_redundancy" {
  type        = bool
  description = "Enable zone redundant deployment for applicable resources"
  default     = true
}

variable "enable_geo_redundancy" {
  type        = bool
  description = "Enable geo-redundant deployment for disaster recovery"
  default     = true
}

# Resource naming convention
variable "resource_name_prefix" {
  type        = string
  description = "Prefix for resource names following naming convention"
  default     = "myx"
  validation {
    condition     = can(regex("^[a-z0-9]{3,6}$", var.resource_name_prefix))
    error_message = "Resource prefix must be 3-6 lowercase alphanumeric characters."
  }
}

# Kubernetes version
variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for AKS cluster"
  default     = "1.25.6"
  validation {
    condition     = can(regex("^1\\.(24|25|26)\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be a supported version (1.24.x, 1.25.x, or 1.26.x)."
  }
}