variable "project_name" {
  description = "Name of the MyElixir project used for resource naming"
  type        = string

  validation {
    condition     = length(var.project_name) > 0 && length(var.project_name) <= 24
    error_message = "Project name must be between 1 and 24 characters"
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

variable "resource_group_name" {
  description = "Name of the Azure resource group where network resources will be deployed"
  type        = string
}

variable "location" {
  description = "Azure region where network resources will be deployed"
  type        = string
}

variable "vnet_address_space" {
  description = "Address space for the virtual network in CIDR notation"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_prefixes" {
  description = "Map of subnet names to their address prefixes in CIDR notation"
  type        = map(string)
  default = {
    aks   = "10.0.1.0/24"
    appgw = "10.0.2.0/24"
    db    = "10.0.3.0/24"
  }
}

variable "enable_ddos_protection" {
  description = "Enable DDoS Protection Plan for enhanced network security"
  type        = bool
  default     = true
}

variable "nsg_rules" {
  description = "Map of network security group rules"
  type = map(object({
    priority                   = number
    direction                  = string
    access                    = string
    protocol                  = string
    source_port_range         = string
    destination_port_range    = string
    source_address_prefix     = string
    destination_address_prefix = string
    subnet                    = string
  }))
  default = {
    allow_https = {
      priority                   = 100
      direction                  = "Inbound"
      access                    = "Allow"
      protocol                  = "Tcp"
      source_port_range         = "*"
      destination_port_range    = "443"
      source_address_prefix     = "Internet"
      destination_address_prefix = "*"
      subnet                    = "appgw"
    }
    allow_health_probe = {
      priority                   = 110
      direction                  = "Inbound"
      access                    = "Allow"
      protocol                  = "Tcp"
      source_port_range         = "*"
      destination_port_range    = "65200-65535"
      source_address_prefix     = "Internet"
      destination_address_prefix = "*"
      subnet                    = "appgw"
    }
  }
}

variable "tags" {
  description = "Resource tags for cost allocation and resource management"
  type        = map(string)
  default     = {}
}