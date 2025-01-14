# Log Analytics Workspace outputs
output "log_analytics_workspace_id" {
  description = "The ID of the Log Analytics workspace for HIPAA-compliant log ingestion"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "The name of the Log Analytics workspace for resource reference"
  value       = azurerm_log_analytics_workspace.main.name
}

output "log_analytics_workspace_workspace_id" {
  description = "The workspace ID of the Log Analytics workspace for agent configuration"
  value       = azurerm_log_analytics_workspace.main.workspace_id
}

# Application Insights outputs
output "application_insights_id" {
  description = "The ID of the Application Insights instance for resource reference"
  value       = azurerm_application_insights.main.id
}

output "application_insights_instrumentation_key" {
  description = "The instrumentation key for Application Insights telemetry configuration"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "The connection string for Application Insights SDK configuration"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

# Monitor Action Group outputs
output "monitor_action_group_id" {
  description = "The ID of the Monitor Action Group for alert configuration"
  value       = azurerm_monitor_action_group.main.id
}

# Alert Rule outputs
output "waf_blocked_requests_alert_id" {
  description = "The ID of the WAF blocked requests alert rule"
  value       = azurerm_monitor_metric_alert.waf_blocked_requests.id
}

output "api_gateway_requests_alert_id" {
  description = "The ID of the API Gateway requests alert rule"
  value       = azurerm_monitor_metric_alert.api_gateway_requests.id
}

output "auth_failures_alert_id" {
  description = "The ID of the authentication failures alert rule"
  value       = azurerm_monitor_metric_alert.auth_failures.id
}

output "db_performance_alert_id" {
  description = "The ID of the database performance alert rule"
  value       = azurerm_monitor_metric_alert.db_performance.id
}

# Diagnostic Settings outputs
output "container_insights_diagnostic_setting_id" {
  description = "The ID of the Container Insights diagnostic setting (if enabled)"
  value       = var.enable_container_insights ? azurerm_monitor_diagnostic_setting.container_insights[0].id : null
}

output "hipaa_audit_diagnostic_setting_id" {
  description = "The ID of the HIPAA audit diagnostic setting"
  value       = azurerm_monitor_diagnostic_setting.hipaa_audit.id
}