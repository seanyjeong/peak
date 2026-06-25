CREATE TABLE IF NOT EXISTS academy_feature_permissions (
    academy_id INT PRIMARY KEY,
    allow_staff_analytics_report TINYINT(1) NOT NULL DEFAULT 0,
    allow_staff_measurement_settings TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
