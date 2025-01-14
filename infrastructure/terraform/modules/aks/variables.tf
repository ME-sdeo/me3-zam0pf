# Core AKS cluster configuration variables
variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where AKS cluster will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where AKS cluster will be deployed"
}

variable "cluster_name" {
  type        = string
  description = "Name of the AKS cluster for the MyElixir healthcare data marketplace"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the AKS cluster"
  default     = "1.25.6"
}

# Node pool configuration with HIPAA-compliant settings
variable "node_pool_config" {
  type = object({
    system_pool = object({
      name                = string
      vm_size            = string
      enable_auto_scaling = bool
      node_count         = number
      min_count          = number
      max_count          = number
      os_disk_size_gb    = number
      os_disk_type       = string
      max_pods           = number
      availability_zones = list(string)
    })
    user_pools = list(object({
      name                = string
      vm_size            = string
      enable_auto_scaling = bool
      node_count         = number
      min_count          = number
      max_count          = number
      os_disk_size_gb    = number
      os_disk_type       = string
      max_pods           = number
      availability_zones = list(string)
      node_labels        = map(string)
      node_taints        = list(string)
    }))
  })
  description = "Configuration for AKS node pools including system and user node pools with HIPAA-compliant settings"
}

# Network profile with security policies
variable "network_profile" {
  type = object({
    network_plugin     = string
    network_policy    = string
    dns_service_ip    = string
    docker_bridge_cidr = string
    service_cidr      = string
    pod_cidr         = string
    outbound_type    = string
    load_balancer_sku = string
  })
  description = "Network configuration for AKS including network policies and security settings"
}

# Azure AD integration configuration
variable "aad_config" {
  type = object({
    managed                = bool
    admin_group_object_ids = list(string)
    azure_rbac_enabled     = bool
    tenant_id             = string
    enable_mfa            = bool
  })
  description = "Azure Active Directory configuration for AKS authentication and authorization"
}

# Monitoring and diagnostics configuration
variable "monitoring_config" {
  type = object({
    log_analytics_workspace_id = string
    metrics_retention_days     = number
    enable_container_insights  = bool
    enable_container_logs     = bool
    enable_audit_logs         = bool
    enable_diagnostic_logs    = bool
  })
  description = "Monitoring and diagnostics settings for AKS cluster observability"
}

# Security and compliance configuration
variable "security_config" {
  type = object({
    enable_pod_security_policy    = bool
    enable_encryption_at_host     = bool
    enable_host_encryption       = bool
    enable_private_cluster       = bool
    private_dns_zone_id          = string
    enable_azure_policy          = bool
    enable_defender              = bool
    allowed_maintenance_windows  = list(object({
      day    = string
      hours  = list(number)
    }))
    key_vault_secrets_provider = object({
      enabled                  = bool
      rotation_poll_interval   = string
      secret_rotation_enabled  = bool
    })
  })
  description = "Security and compliance settings for HIPAA-compliant AKS deployment"
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for organization and compliance tracking"
  default     = {
    Environment = "production"
    ManagedBy   = "terraform"
    Project     = "myelixir"
    Compliance  = "hipaa"
  }
}