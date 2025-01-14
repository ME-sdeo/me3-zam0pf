# Provider configuration
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Local values for configuration
locals {
  cluster_name = "${var.cluster_name}-${random_string.suffix.result}"
  
  default_node_pool = {
    name                = "systempool"
    vm_size            = "Standard_D4s_v3"
    enable_auto_scaling = true
    node_count         = 3
    min_count          = 3
    max_count          = 5
    os_disk_size_gb    = 128
    os_disk_type       = "Premium_LRS"
    max_pods           = 50
    availability_zones = ["1", "2", "3"]
    node_labels = {
      "nodepool-type" = "system"
      "environment"   = "production"
      "nodepoolos"    = "linux"
      "app"           = "system-apps"
    }
  }

  network_profile = {
    network_plugin     = "azure"
    network_policy     = "calico"
    dns_service_ip     = "10.0.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
    service_cidr       = "10.0.0.0/16"
    pod_cidr          = "10.244.0.0/16"
    outbound_type     = "userDefinedRouting"
    load_balancer_sku = "standard"
  }
}

# Random string for unique naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "aks" {
  name                = local.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix         = local.cluster_name
  kubernetes_version = var.kubernetes_version
  sku_tier           = "Paid"

  default_node_pool {
    name                = local.default_node_pool.name
    vm_size            = local.default_node_pool.vm_size
    enable_auto_scaling = local.default_node_pool.enable_auto_scaling
    node_count         = local.default_node_pool.node_count
    min_count          = local.default_node_pool.min_count
    max_count          = local.default_node_pool.max_count
    os_disk_size_gb    = local.default_node_pool.os_disk_size_gb
    os_disk_type       = local.default_node_pool.os_disk_type
    max_pods           = local.default_node_pool.max_pods
    zones              = local.default_node_pool.availability_zones
    node_labels        = local.default_node_pool.node_labels
    vnet_subnet_id     = var.network_profile.subnet_id
    
    upgrade_settings {
      max_surge = "33%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  azure_active_directory_role_based_access_control {
    managed                = true
    admin_group_object_ids = var.aad_config.admin_group_object_ids
    azure_rbac_enabled     = true
    tenant_id             = var.aad_config.tenant_id
  }

  network_profile {
    network_plugin     = local.network_profile.network_plugin
    network_policy     = local.network_profile.network_policy
    dns_service_ip     = local.network_profile.dns_service_ip
    docker_bridge_cidr = local.network_profile.docker_bridge_cidr
    service_cidr       = local.network_profile.service_cidr
    pod_cidr          = local.network_profile.pod_cidr
    outbound_type     = local.network_profile.outbound_type
    load_balancer_sku = local.network_profile.load_balancer_sku
  }

  azure_policy_enabled = var.security_config.enable_azure_policy
  
  microsoft_defender {
    enabled = var.security_config.enable_defender
  }

  oms_agent {
    log_analytics_workspace_id = var.monitoring_config.log_analytics_workspace_id
  }

  key_vault_secrets_provider {
    secret_rotation_enabled  = var.security_config.key_vault_secrets_provider.secret_rotation_enabled
    rotation_poll_interval  = var.security_config.key_vault_secrets_provider.rotation_poll_interval
  }

  maintenance_window {
    dynamic "allowed" {
      for_each = var.security_config.allowed_maintenance_windows
      content {
        day   = allowed.value.day
        hours = allowed.value.hours
      }
    }
  }

  private_cluster_enabled = var.security_config.enable_private_cluster
  private_dns_zone_id    = var.security_config.private_dns_zone_id

  auto_scaler_profile {
    balance_similar_node_groups = true
    expander                   = "random"
    max_graceful_termination_sec = 600
    max_node_provisioning_time   = "15m"
    max_unready_nodes            = 3
    max_unready_percentage       = 45
    new_pod_scale_up_delay       = "10s"
    scale_down_delay_after_add   = "10m"
    scale_down_delay_after_delete = "10s"
    scale_down_delay_after_failure = "3m"
    scan_interval                = "10s"
    utilization_threshold        = "0.5"
  }

  tags = merge(var.tags, {
    "cluster-name" = local.cluster_name
  })
}

# Outputs
output "cluster_id" {
  value       = azurerm_kubernetes_cluster.aks.id
  description = "The ID of the AKS cluster"
}

output "cluster_name" {
  value       = azurerm_kubernetes_cluster.aks.name
  description = "The name of the AKS cluster"
}

output "kube_config" {
  value = {
    raw  = azurerm_kubernetes_cluster.aks.kube_config_raw
    host = azurerm_kubernetes_cluster.aks.kube_config[0].host
  }
  sensitive   = true
  description = "Kubernetes configuration for cluster access"
}

output "node_resource_group" {
  value       = azurerm_kubernetes_cluster.aks.node_resource_group
  description = "The resource group containing AKS cluster nodes"
}