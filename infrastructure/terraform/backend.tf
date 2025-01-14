# Backend configuration for Terraform state management
# Provider version: azurerm ~> 3.0

terraform {
  backend "azurerm" {
    # Resource group containing the storage account for Terraform state
    resource_group_name = "${var.project_name}-tfstate-rg"
    
    # Storage account name for Terraform state files
    # Must be globally unique across Azure
    storage_account_name = "${var.project_name}tfstate"
    
    # Container name within storage account
    container_name = "tfstate"
    
    # State file name based on environment
    key = "${var.environment}.terraform.tfstate"
    
    # Enable Azure AD authentication for enhanced security
    use_azuread_auth = true
    
    # Azure subscription details
    subscription_id = "${var.subscription_id}"
    tenant_id = "${var.tenant_id}"
    
    # Use Microsoft Graph API and OIDC for modern authentication
    use_microsoft_graph = true
    use_oidc = true
    
    # Storage account configuration for HIPAA compliance
    # Note: These are applied through the Azure Portal or separate Terraform configuration
    # as they cannot be set directly in the backend block
    
    # Ensure minimum TLS version
    min_tls_version = "TLS1_2"
    
    # Enable infrastructure encryption
    infrastructure_encryption_enabled = true
    
    # Enable versioning for state file history
    versioning_enabled = true
    
    # Configure network rules for secure access
    network_rules {
      default_action = "Deny"
      bypass = ["AzureServices"]
    }
    
    # Configure encryption for data at rest
    encryption {
      services {
        blob {
          enabled = true
          key_type = "Account"
        }
        file {
          enabled = true
          key_type = "Account"
        }
      }
      key_source = "Microsoft.Storage"
      require_infrastructure_encryption = true
    }
    
    # Configure blob properties for data protection
    blob_properties {
      versioning_enabled = true
      delete_retention_policy {
        days = 30
      }
      container_delete_retention_policy {
        days = 30
      }
    }
  }

  # Required provider configuration
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}