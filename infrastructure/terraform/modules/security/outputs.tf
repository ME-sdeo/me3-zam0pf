# Key Vault outputs
output "key_vault_id" {
  description = "The resource ID of the Azure Key Vault"
  value       = azurerm_key_vault.main.id
  sensitive   = false
}

output "key_vault_uri" {
  description = "The URI of the Azure Key Vault for performing key and secret operations"
  value       = azurerm_key_vault.main.vault_uri
  sensitive   = false
}

output "key_vault_name" {
  description = "The name of the Azure Key Vault resource"
  value       = azurerm_key_vault.main.name
  sensitive   = false
}

output "encryption_key_id" {
  description = "The resource ID of the HSM-protected encryption key"
  value       = azurerm_key_vault_key.encryption_key.id
  sensitive   = false
}

# WAF Policy outputs
output "waf_policy_id" {
  description = "The resource ID of the Web Application Firewall policy"
  value       = azurerm_web_application_firewall_policy.main.id
  sensitive   = false
}

output "waf_policy_name" {
  description = "The name of the Web Application Firewall policy"
  value       = azurerm_web_application_firewall_policy.main.name
  sensitive   = false
}