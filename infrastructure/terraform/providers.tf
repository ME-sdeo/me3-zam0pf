# Configure Terraform and required providers
terraform {
  # Terraform version constraint for stability and feature support
  required_version = ">= 1.3.0"

  # Required provider configurations with version constraints
  required_providers {
    # Azure Resource Manager provider for core infrastructure
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    
    # Azure Active Directory provider for identity management
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.0"
    }
    
    # Random provider for generating secure identifiers
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    
    # TLS provider for certificate management
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Configure Azure Resource Manager provider with HIPAA-compliant features
provider "azurerm" {
  features {
    # Key Vault security configuration
    key_vault {
      # Maintain soft-deleted vaults and secrets for HIPAA compliance
      purge_soft_delete_on_destroy               = false
      recover_soft_deleted_key_vaults            = true
      purge_soft_deleted_secrets_on_destroy      = false
    }

    # Resource group protection settings
    resource_group {
      # Prevent accidental resource deletion
      prevent_deletion_if_contains_resources = true
    }

    # Virtual machine security settings
    virtual_machine {
      # Ensure proper cleanup of OS disks
      delete_os_disk_on_deletion = true
      # Enable graceful shutdown for data protection
      graceful_shutdown         = true
    }

    # Log Analytics workspace retention settings
    log_analytics_workspace {
      # Maintain logs for compliance requirements
      permanently_delete_on_destroy = false
    }
  }

  # Enable Azure AD authentication for storage accounts
  storage_use_azuread = true
  
  # Use Managed Service Identity for secure authentication
  use_msi = true
}

# Configure Azure Active Directory provider
provider "azuread" {
  # Use Managed Service Identity for secure authentication
  use_msi = true
  
  # Use environment-specific tenant ID
  tenant_id = var.tenant_id
  
  # Set environment-specific configuration
  environment = var.environment
}