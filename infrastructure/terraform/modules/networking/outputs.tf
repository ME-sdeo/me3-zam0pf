# Output variables for the networking module with HIPAA compliance context

output "vnet_name" {
  description = "Name of the virtual network with HIPAA-compliant network isolation"
  value       = azurerm_virtual_network.vnet.name
  sensitive   = false
}

output "vnet_id" {
  description = "Resource ID of the virtual network for secure cross-resource integration"
  value       = azurerm_virtual_network.vnet.id
  sensitive   = false
}

output "subnet_ids" {
  description = "Map of subnet names to their resource IDs for secure network segmentation"
  value       = {
    for subnet_key, subnet in azurerm_subnet.subnets :
    subnet_key => subnet.id
  }
  sensitive = false
}

output "nsg_ids" {
  description = "Map of NSG names to their resource IDs for security rule management"
  value       = {
    for nsg_key, nsg in azurerm_network_security_group.nsgs :
    nsg_key => nsg.id
  }
  sensitive = false
}

output "ddos_protection_plan_id" {
  description = "Resource ID of the DDoS protection plan for network threat protection"
  value       = var.enable_ddos_protection ? azurerm_network_ddos_protection_plan.ddos[0].id : null
  sensitive   = false
}

output "subnet_address_prefixes" {
  description = "Map of subnet names to their address prefixes for network planning"
  value       = {
    for subnet_key, subnet in azurerm_subnet.subnets :
    subnet_key => subnet.address_prefixes[0]
  }
  sensitive = false
}

output "vnet_address_space" {
  description = "Address space of the virtual network for network architecture documentation"
  value       = azurerm_virtual_network.vnet.address_space
  sensitive   = false
}

output "nsg_rule_sets" {
  description = "Map of NSG names to their security rule configurations for compliance auditing"
  value       = {
    for nsg_key, nsg in azurerm_network_security_group.nsgs :
    nsg_key => {
      id   = nsg.id
      name = nsg.name
      tags = nsg.tags
    }
  }
  sensitive = false
}