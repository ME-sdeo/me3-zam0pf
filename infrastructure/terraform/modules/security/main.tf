# Azure Resource Manager and Random providers
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

# Get current Azure subscription details
data "azurerm_client_config" "current" {}

# Local variables for resource naming and tagging
locals {
  key_vault_name = "${var.project_name}-${var.environment}-kv"
  waf_policy_name = "${var.project_name}-${var.environment}-waf"
  common_tags = {
    Project             = "MyElixir"
    Environment         = var.environment
    ManagedBy          = "Terraform"
    SecurityCompliance  = "HIPAA"
    DataClassification = "PHI"
  }
}

# Azure Key Vault with FIPS 140-2 Level 2 HSM support
resource "azurerm_key_vault" "main" {
  name                = local.key_vault_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id          = data.azurerm_client_config.current.tenant_id
  sku_name           = var.key_vault_sku

  # HIPAA compliance settings
  soft_delete_retention_days  = 90
  purge_protection_enabled    = true
  enabled_for_disk_encryption = true
  enabled_for_deployment      = true
  enabled_for_template_deployment = true

  # Network security controls
  network_acls {
    bypass                    = "AzureServices"
    default_action           = "Deny"
    ip_rules                = var.allowed_ip_ranges
    virtual_network_subnet_ids = []
  }

  # Enable diagnostic settings for monitoring
  lifecycle {
    prevent_destroy = true
  }

  tags = local.common_tags
}

# HSM-protected encryption key with automatic rotation
resource "azurerm_key_vault_key" "encryption_key" {
  name         = "encryption-key"
  key_vault_id = azurerm_key_vault.main.id
  key_type     = "RSA-HSM"
  key_size     = 2048
  key_opts     = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey"
  ]

  rotation_policy {
    automatic {
      time_after_creation = "${var.key_rotation_days}d"
    }
  }

  depends_on = [azurerm_key_vault.main]
}

# Web Application Firewall policy with OWASP 3.2 ruleset
resource "azurerm_web_application_firewall_policy" "main" {
  name                = local.waf_policy_name
  resource_group_name = var.resource_group_name
  location            = var.location

  policy_settings {
    enabled                     = true
    mode                       = var.waf_policy_mode
    request_body_check         = true
    max_request_body_size_in_kb = 128
    file_upload_limit_in_mb    = 100
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
      rule_group_override {
        rule_group_name = "REQUEST-920-PROTOCOL-ENFORCEMENT"
        disabled_rules  = []
      }
      rule_group_override {
        rule_group_name = "REQUEST-930-APPLICATION-ATTACK-LFI"
        disabled_rules  = []
      }
      rule_group_override {
        rule_group_name = "REQUEST-942-APPLICATION-ATTACK-SQLI"
        disabled_rules  = []
      }
    }
  }

  custom_rules {
    name      = "BlockMaliciousRequests"
    priority  = 1
    rule_type = "MatchRule"
    action    = "Block"

    match_conditions {
      match_variables {
        variable_name = "RequestHeaders"
        selector     = "User-Agent"
      }
      operator           = "Contains"
      negation_condition = false
      match_values       = ["Malicious", "Suspicious"]
    }
  }

  tags = local.common_tags
}

# Outputs for use by other modules
output "key_vault_id" {
  value       = azurerm_key_vault.main.id
  description = "The ID of the Key Vault"
}

output "key_vault_uri" {
  value       = azurerm_key_vault.main.vault_uri
  description = "The URI of the Key Vault"
}

output "waf_policy_id" {
  value       = azurerm_web_application_firewall_policy.main.id
  description = "The ID of the WAF policy"
}