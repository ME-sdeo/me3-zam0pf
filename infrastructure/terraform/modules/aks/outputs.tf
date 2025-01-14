# Core cluster identification outputs
output "cluster_id" {
  description = "The resource ID of the AKS cluster for secure reference in other resources and RBAC configurations"
  value       = azurerm_kubernetes_cluster.aks.id
  sensitive   = false
}

output "cluster_name" {
  description = "The name of the AKS cluster for reference in deployment configurations and monitoring setup"
  value       = azurerm_kubernetes_cluster.aks.name
  sensitive   = false
}

# Kubernetes configuration outputs - marked sensitive for HIPAA compliance
output "kube_config" {
  description = "Raw kubernetes configuration for cluster access - marked sensitive to protect credentials"
  value       = azurerm_kubernetes_cluster.aks.kube_config_raw
  sensitive   = true
}

output "kube_admin_config" {
  description = "Administrative kubernetes configuration for privileged cluster management - marked sensitive"
  value       = azurerm_kubernetes_cluster.aks.kube_admin_config_raw
  sensitive   = true
}

# Network configuration outputs
output "cluster_private_fqdn" {
  description = "Private fully qualified domain name of the AKS cluster for secure internal network access"
  value       = azurerm_kubernetes_cluster.aks.private_fqdn
  sensitive   = false
}

# Identity and security outputs
output "cluster_identity" {
  description = "System-assigned managed identity details for secure RBAC and resource access configuration"
  value       = azurerm_kubernetes_cluster.aks.identity
  sensitive   = false
}

output "kubelet_identity" {
  description = "Kubelet managed identity details for node pool authentication and authorization"
  value       = azurerm_kubernetes_cluster.aks.kubelet_identity
  sensitive   = false
}

# Network profile output for CNI and security policy configuration
output "network_profile" {
  description = "Network configuration details including CNI settings and network security policies"
  value       = azurerm_kubernetes_cluster.aks.network_profile
  sensitive   = false
}

# Node resource group output
output "node_resource_group" {
  description = "The auto-generated resource group containing all AKS cluster resources"
  value       = azurerm_kubernetes_cluster.aks.node_resource_group
  sensitive   = false
}

# Principal ID output for RBAC assignments
output "principal_id" {
  description = "The principal ID of the system assigned identity for the AKS cluster"
  value       = azurerm_kubernetes_cluster.aks.identity[0].principal_id
  sensitive   = false
}

# Cluster endpoint outputs
output "private_cluster_enabled" {
  description = "Boolean indicating if the cluster is running in private mode for HIPAA compliance"
  value       = azurerm_kubernetes_cluster.aks.private_cluster_enabled
  sensitive   = false
}

output "api_server_authorized_ip_ranges" {
  description = "The IP ranges authorized for API server access"
  value       = azurerm_kubernetes_cluster.aks.api_server_authorized_ip_ranges
  sensitive   = false
}

# Monitoring outputs
output "log_analytics_workspace_id" {
  description = "The Log Analytics workspace ID used for cluster monitoring"
  value       = azurerm_kubernetes_cluster.aks.oms_agent[0].log_analytics_workspace_id
  sensitive   = false
}