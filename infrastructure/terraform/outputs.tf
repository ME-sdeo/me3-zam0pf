# Azure Kubernetes Service (AKS) Outputs
output "aks_cluster_name" {
  description = "The name of the AKS cluster"
  value       = module.aks.cluster_name
}

output "aks_resource_group_name" {
  description = "The name of the resource group containing the AKS cluster"
  value       = module.aks.resource_group_name
}

# Azure Key Vault Outputs
output "key_vault_uri" {
  description = "The URI of the Key Vault instance"
  value       = module.key_vault.vault_uri
}

# Application Insights Outputs
output "application_insights_key" {
  description = "The instrumentation key for Application Insights"
  value       = module.monitoring.application_insights_key
  sensitive   = true
}

# Networking Outputs
output "vnet_name" {
  description = "The name of the Virtual Network"
  value       = module.networking.vnet_name
}

output "subnet_ids" {
  description = "Map of subnet names to subnet IDs"
  value = {
    aks     = module.networking.aks_subnet_id
    ingress = module.networking.ingress_subnet_id
    data    = module.networking.data_subnet_id
  }
}

# Azure Container Registry Outputs
output "acr_login_server" {
  description = "The login server URL for Azure Container Registry"
  value       = module.acr.login_server
}

# Log Analytics Outputs
output "log_analytics_workspace_id" {
  description = "The workspace ID of the Log Analytics instance"
  value       = module.monitoring.workspace_id
}

# Additional Security Outputs
output "network_security_group_ids" {
  description = "Map of NSG names to NSG IDs"
  value       = module.networking.network_security_group_ids
}

# Monitoring and Diagnostics Outputs
output "monitor_action_group_id" {
  description = "The ID of the Azure Monitor action group for alerts"
  value       = module.monitoring.action_group_id
}

output "diagnostic_settings_id" {
  description = "The ID of the diagnostic settings for the infrastructure"
  value       = module.monitoring.diagnostic_settings_id
}

# FHIR Service Outputs
output "fhir_service_endpoint" {
  description = "The endpoint URL for the FHIR service"
  value       = module.fhir.service_endpoint
  sensitive   = true
}

# Load Balancer Outputs
output "ingress_public_ip" {
  description = "The public IP address of the ingress controller"
  value       = module.aks.ingress_public_ip
}

# Storage Outputs
output "storage_account_name" {
  description = "The name of the storage account for application data"
  value       = module.storage.account_name
}

# Backup Outputs
output "backup_vault_name" {
  description = "The name of the backup vault"
  value       = module.backup.vault_name
}

# Identity Management Outputs
output "managed_identity_ids" {
  description = "Map of managed identity names to their IDs"
  value       = module.identity.managed_identity_ids
}

# Compliance and Audit Outputs
output "log_retention_days" {
  description = "The number of days logs are retained"
  value       = module.monitoring.log_retention_days
}

output "compliance_storage_container_url" {
  description = "The URL of the compliance data storage container"
  value       = module.storage.compliance_container_url
  sensitive   = true
}

# Resource Tags
output "resource_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}

# Disaster Recovery Outputs
output "dr_region_resources" {
  description = "Map of disaster recovery region resource IDs"
  value       = module.dr.resource_ids
  sensitive   = true
}