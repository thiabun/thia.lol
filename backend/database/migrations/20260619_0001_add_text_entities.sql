CREATE TABLE IF NOT EXISTS text_entities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_type VARCHAR(30) NOT NULL,
  content_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(40) NOT NULL DEFAULT 'body',
  entity_type VARCHAR(20) NOT NULL,
  entity_start INT UNSIGNED NOT NULL,
  entity_length INT UNSIGNED NOT NULL,
  text_value VARCHAR(1000) NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  url VARCHAR(1000) NULL,
  card_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY text_entities_content_field_idx (content_type, content_id, field_name, entity_start),
  KEY text_entities_target_user_idx (target_user_id, created_at),
  KEY text_entities_type_idx (entity_type),
  CONSTRAINT text_entities_target_user_fk
    FOREIGN KEY (target_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
