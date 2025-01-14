# Azure Network Module for MyElixir Healthcare Data Marketplace
# Version: 1.0.0
# Provider version: azurerm ~> 3.0

locals {
  vnet_name = "${var.project_name}-${var.environment}-vnet"
  nsg_name_prefix = "${var.project_name}-${var.environment}-nsg"
  ddos_plan_name = "${var.project_name}-${var.environment}-ddos-plan"
}

# DDoS Protection Plan for enhanced network security
resource "azurerm_network_ddos_protection_plan" "ddos" {
  count               = var.enable_ddos_protection ? 1 : 0
  name                = local.ddos_plan_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tags = merge(var.tags, {
    compliance = "hipaa"
    component  = "network-security"
  })
}

# Virtual Network with HIPAA-compliant configuration
resource "azurerm_virtual_network" "vnet" {
  name                = local.vnet_name
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space

  # DDoS protection configuration
  dynamic "ddos_protection_plan" {
    for_each = var.enable_ddos_protection ? [1] : []
    content {
      id     = azurerm_network_ddos_protection_plan.ddos[0].id
      enable = true
    }
  }

  tags = merge(var.tags, {
    compliance  = "hipaa"
    environment = var.environment
    component   = "network"
  })
}

# Subnet configuration with service endpoints
resource "azurerm_subnet" "subnets" {
  for_each = var.subnet_prefixes

  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = [each.value]

  # Enable service endpoints for secure service access
  service_endpoints = [
    "Microsoft.KeyVault",
    "Microsoft.ContainerRegistry",
    "Microsoft.Sql",
    "Microsoft.Storage"
  ]

  # Enable private link endpoint policies
  enforce_private_link_endpoint_network_policies = true
}

# Network Security Groups with HIPAA-compliant rules
resource "azurerm_network_security_group" "nsgs" {
  for_each = var.subnet_prefixes

  name                = "${local.nsg_name_prefix}-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name

  tags = merge(var.tags, {
    compliance = "hipaa"
    subnet     = each.key
    component  = "network-security"
  })
}

# NSG Rules based on configuration
resource "azurerm_network_security_rule" "rules" {
  for_each = var.nsg_rules

  name                        = each.key
  priority                    = each.value.priority
  direction                   = each.value.direction
  access                      = each.value.access
  protocol                    = each.value.protocol
  source_port_range          = each.value.source_port_range
  destination_port_range     = each.value.destination_port_range
  source_address_prefix      = each.value.source_address_prefix
  destination_address_prefix = each.value.destination_address_prefix
  resource_group_name        = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.nsgs[each.value.subnet].name
}

# Subnet-NSG Associations
resource "azurerm_subnet_network_security_group_association" "associations" {
  for_each = var.subnet_prefixes

  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.nsgs[each.key].id
}

# Outputs for use in other modules
output "vnet_id" {
  description = "Resource ID of the created virtual network"
  value       = azurerm_virtual_network.vnet.id
}

output "subnet_ids" {
  description = "Map of subnet names to their resource IDs"
  value       = { for k, v in azurerm_subnet.subnets : k => v.id }
}

output "nsg_ids" {
  description = "Map of NSG names to their resource IDs"
  value       = { for k, v in azurerm_network_security_group.nsgs : k => v.id }
}

output "ddos_protection_plan_id" {
  description = "Resource ID of the DDoS protection plan if enabled"
  value       = var.enable_ddos_protection ? azurerm_network_ddos_protection_plan.ddos[0].id : null
}