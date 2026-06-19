CREATE TABLE IF NOT EXISTS user_onboarding_state (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  completed_steps_json JSON NULL,
  skipped_steps_json JSON NULL,
  provider_links_json JSON NULL,
  finished_at DATETIME NULL,
  dismissed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_onboarding_state_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
