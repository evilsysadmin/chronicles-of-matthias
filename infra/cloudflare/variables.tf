variable "cloudflare_zone_name" {
  description = "Existing Cloudflare zone; no ownership of the zone is assumed."
  type        = string
  default     = "shadowops.dpdns.org"
}

variable "production_hostname" {
  type    = string
  default = "chronicles.shadowops.dpdns.org"
}

variable "staging_hostname" {
  type    = string
  default = "staging.chronicles.shadowops.dpdns.org"
}
