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

# Local variables for resource naming and tagging
locals {
  workspace_name     = format("law-%s-%s", var.environment, random_string.suffix.result)
  app_insights_name  = format("ai-%s-%s", var.environment, random_string.suffix.result)
  alert_group_name   = format("ag-%s-%s", var.environment, random_string.suffix.result)
  hipaa_tags        = merge(var.tags, { compliance = "hipaa", retention = "7-years" })
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Log Analytics Workspace for centralized logging
resource "azurerm_log_analytics_workspace" "main" {
  name                = local.workspace_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days # 7 years for HIPAA compliance
  
  tags = local.hipaa_tags

  # HIPAA-compliant workspace settings
  daily_quota_gb = 100
  internet_ingestion_enabled = true
  internet_query_enabled    = true
}

# Application Insights for application monitoring
resource "azurerm_application_insights" "main" {
  name                = local.app_insights_name
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  tags = local.hipaa_tags

  # Privacy and security settings
  disable_ip_masking = false
  sampling_percentage = 100
}

# Action group for alerts
resource "azurerm_monitor_action_group" "main" {
  name                = local.alert_group_name
  resource_group_name = var.resource_group_name
  short_name          = "alerts"

  email_receiver {
    name                    = "security-team"
    email_address          = "security@myelixir.com"
    use_common_alert_schema = true
  }

  sms_receiver {
    name         = "oncall"
    country_code = "1"
    phone_number = "5555555555"
  }

  tags = local.hipaa_tags
}

# WAF blocked requests alert
resource "azurerm_monitor_metric_alert" "waf_blocked_requests" {
  name                = "waf-blocked-requests-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when WAF blocked requests exceed threshold"
  severity            = var.alert_thresholds.waf_blocked_requests.severity
  window_size         = var.alert_thresholds.waf_blocked_requests.window_size
  frequency           = "PT1M"

  criteria {
    metric_namespace = "Microsoft.Network/applicationGateways"
    metric_name      = "BlockedRequests"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.waf_blocked_requests.threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.hipaa_tags
}

# API Gateway requests alert
resource "azurerm_monitor_metric_alert" "api_gateway_requests" {
  name                = "api-gateway-requests-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when API Gateway requests exceed threshold"
  severity            = var.alert_thresholds.api_gateway_requests.severity
  window_size         = var.alert_thresholds.api_gateway_requests.window_size
  frequency           = "PT1M"

  criteria {
    metric_namespace = "Microsoft.ApiManagement/service"
    metric_name      = "TotalRequests"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.api_gateway_requests.threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.hipaa_tags
}

# Authentication failures alert
resource "azurerm_monitor_metric_alert" "auth_failures" {
  name                = "auth-failures-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when authentication failures exceed threshold"
  severity            = var.alert_thresholds.auth_failures.severity
  window_size         = var.alert_thresholds.auth_failures.window_size
  frequency           = "PT5M"

  criteria {
    metric_namespace = "Microsoft.AAD/b2c"
    metric_name      = "FailedSignInAttempts"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.auth_failures.threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.hipaa_tags
}

# Database query performance alert
resource "azurerm_monitor_metric_alert" "db_performance" {
  name                = "db-performance-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when database query performance degrades"
  severity            = var.alert_thresholds.database_query_performance.severity
  window_size         = var.alert_thresholds.database_query_performance.window_size
  frequency           = "PT5M"

  criteria {
    metric_namespace = "Microsoft.DocumentDB/databaseAccounts"
    metric_name      = "QueryDuration"
    aggregation      = "P95"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.database_query_performance.threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.hipaa_tags
}

# Container insights configuration (if enabled)
resource "azurerm_monitor_diagnostic_setting" "container_insights" {
  count                      = var.enable_container_insights ? 1 : 0
  name                       = "container-insights"
  target_resource_id         = azurerm_application_insights.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  log {
    category = "ContainerInsights"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }
}

# Diagnostic settings for HIPAA compliance
resource "azurerm_monitor_diagnostic_setting" "hipaa_audit" {
  name                       = "hipaa-audit-logs"
  target_resource_id         = azurerm_log_analytics_workspace.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  log {
    category = "Audit"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }

  log {
    category = "Security"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }
}