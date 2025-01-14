# MyElixir Healthcare Data Marketplace Infrastructure
# Terraform version: ~> 1.0
# Provider versions:
# - azurerm ~> 3.0
# - random ~> 3.0
# - kubernetes ~> 2.0

terraform {
  required_version = "~> 1.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  backend "azurerm" {
    # Backend configuration should be provided via backend config file or CLI
  }
}

# Configure Azure RM provider with features
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_keys    = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}

# Local variables for resource naming and tagging
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project              = "MyElixir"
    Environment          = var.environment
    ManagedBy           = "Terraform"
    DataClassification  = "PHI"
    ComplianceFramework = "HIPAA"
    LastUpdated         = timestamp()
  }
}

# Random string for unique naming
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
}

# Primary resource group
resource "azurerm_resource_group" "primary" {
  name     = "${local.resource_prefix}-${var.primary_location}-rg"
  location = var.primary_location
  tags     = local.common_tags
}

# Secondary resource group for DR
resource "azurerm_resource_group" "secondary" {
  count    = var.enable_geo_redundancy ? 1 : 0
  name     = "${local.resource_prefix}-${var.secondary_location}-rg"
  location = var.secondary_location
  tags     = local.common_tags
}

# Networking module for primary region
module "networking_primary" {
  source = "./modules/networking"

  project_name        = var.project_name
  environment         = var.environment
  resource_group_name = azurerm_resource_group.primary.name
  location           = var.primary_location
  address_space      = [var.network_address_space[0]]
  
  subnet_configs = {
    aks = {
      name             = "aks"
      address_prefixes = ["10.0.1.0/24"]
    }
    private_endpoints = {
      name             = "private-endpoints"
      address_prefixes = ["10.0.2.0/24"]
    }
  }

  enable_ddos_protection = var.environment == "prod"
  enable_bastion        = true
  tags                  = local.common_tags
}

# Networking module for secondary region
module "networking_secondary" {
  count  = var.enable_geo_redundancy ? 1 : 0
  source = "./modules/networking"

  project_name        = var.project_name
  environment         = var.environment
  resource_group_name = azurerm_resource_group.secondary[0].name
  location           = var.secondary_location
  address_space      = [var.network_address_space[1]]
  
  subnet_configs = {
    aks = {
      name             = "aks"
      address_prefixes = ["10.1.1.0/24"]
    }
    private_endpoints = {
      name             = "private-endpoints"
      address_prefixes = ["10.1.2.0/24"]
    }
  }

  enable_ddos_protection = var.environment == "prod"
  enable_bastion        = true
  tags                  = local.common_tags
}

# Primary AKS cluster
module "aks_primary" {
  source = "./modules/aks"

  project_name         = var.project_name
  environment          = var.environment
  resource_group_name  = azurerm_resource_group.primary.name
  location            = var.primary_location
  kubernetes_version   = var.kubernetes_version
  
  node_pools = {
    system = {
      name                = "system"
      node_count         = var.aks_node_count
      vm_size            = var.aks_node_size
      availability_zones = var.enable_zone_redundancy ? ["1", "2", "3"] : null
      subnet_id          = module.networking_primary.subnet_ids["aks"]
    }
  }

  enable_host_encryption    = true
  enable_pod_security      = true
  enable_azure_policy      = true
  enable_monitoring        = var.enable_monitoring
  enable_diagnostic_logs   = var.enable_audit_logging
  
  network_plugin          = "azure"
  network_policy          = "azure"
  service_cidr           = "172.16.0.0/16"
  dns_service_ip         = "172.16.0.10"
  docker_bridge_cidr     = "172.17.0.1/16"
  
  tags = local.common_tags
}

# Secondary AKS cluster for DR
module "aks_secondary" {
  count  = var.enable_geo_redundancy ? 1 : 0
  source = "./modules/aks"

  project_name         = var.project_name
  environment          = var.environment
  resource_group_name  = azurerm_resource_group.secondary[0].name
  location            = var.secondary_location
  kubernetes_version   = var.kubernetes_version
  
  node_pools = {
    system = {
      name                = "system"
      node_count         = var.aks_node_count
      vm_size            = var.aks_node_size
      availability_zones = var.enable_zone_redundancy ? ["1", "2", "3"] : null
      subnet_id          = module.networking_secondary[0].subnet_ids["aks"]
    }
  }

  enable_host_encryption    = true
  enable_pod_security      = true
  enable_azure_policy      = true
  enable_monitoring        = var.enable_monitoring
  enable_diagnostic_logs   = var.enable_audit_logging
  
  network_plugin          = "azure"
  network_policy          = "azure"
  service_cidr           = "172.18.0.0/16"
  dns_service_ip         = "172.18.0.10"
  docker_bridge_cidr     = "172.19.0.1/16"
  
  tags = local.common_tags
}

# Outputs
output "resource_group_primary" {
  value = azurerm_resource_group.primary.name
  description = "Primary resource group name"
}

output "resource_group_secondary" {
  value = var.enable_geo_redundancy ? azurerm_resource_group.secondary[0].name : null
  description = "Secondary resource group name"
}

output "aks_cluster_primary" {
  value = module.aks_primary.cluster_name
  description = "Primary AKS cluster name"
}

output "aks_cluster_secondary" {
  value = var.enable_geo_redundancy ? module.aks_secondary[0].cluster_name : null
  description = "Secondary AKS cluster name"
}

output "primary_vnet_name" {
  value = module.networking_primary.vnet_name
  description = "Primary virtual network name"
}

output "secondary_vnet_name" {
  value = var.enable_geo_redundancy ? module.networking_secondary[0].vnet_name : null
  description = "Secondary virtual network name"
}