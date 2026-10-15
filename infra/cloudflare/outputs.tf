output "production_url" {
  value = "https://${var.production_hostname}"
}

output "staging_url" {
  value = "https://${var.staging_hostname}"
}

output "zone_name" {
  value = var.cloudflare_zone_name
}
