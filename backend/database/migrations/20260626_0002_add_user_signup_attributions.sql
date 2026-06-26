CREATE TABLE IF NOT EXISTS user_signup_attributions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(80) NULL,
  medium VARCHAR(80) NULL,
  campaign VARCHAR(120) NULL,
  share_kind ENUM('profile', 'post', 'room') NULL,
  share_ref VARCHAR(120) NULL,
  referrer_host VARCHAR(255) NULL,
  landing_path VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_signup_attributions_user_unique (user_id),
  KEY user_signup_attributions_source_created_idx (source, created_at),
  KEY user_signup_attributions_campaign_created_idx (campaign, created_at),
  KEY user_signup_attributions_share_created_idx (share_kind, share_ref, created_at),
  CONSTRAINT user_signup_attributions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
