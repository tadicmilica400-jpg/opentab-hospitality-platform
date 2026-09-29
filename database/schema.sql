CREATE DATABASE IF NOT EXISTS `opentab`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `opentab`;

CREATE TABLE IF NOT EXISTS `users` (
	`id` VARCHAR(8),
	`first_name` VARCHAR(255) NOT NULL,
	`last_name` VARCHAR(255) NOT NULL,
	`email` VARCHAR(255) NOT NULL UNIQUE,
	`phone` VARCHAR(60) NOT NULL UNIQUE,
	`username` VARCHAR(64) NOT NULL UNIQUE,
	`password_hash` VARCHAR(255) NOT NULL,
	`role` ENUM('owner', 'waiter', 'guest') NOT NULL,
	`status` ENUM('active', 'deactivated', 'blocked') NOT NULL DEFAULT 'active',
	`image` TEXT,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_users_email`
ON `users` (`email`);
CREATE INDEX `idx_users_username`
ON `users` (`username`);
CREATE INDEX `idx_users_role`
ON `users` (`role`);
CREATE TABLE IF NOT EXISTS `owners` (
	`user_id` VARCHAR(8),
	PRIMARY KEY(`user_id`)
);


CREATE TABLE IF NOT EXISTS `guests` (
	`user_id` VARCHAR(8),
	`reward_points` INTEGER NOT NULL DEFAULT 0 CHECK(`reward_points` >= 0),
	PRIMARY KEY(`user_id`)
);


CREATE TABLE IF NOT EXISTS `venues` (
	`id` VARCHAR(64),
	`owner_id` VARCHAR(8) NOT NULL,
	`name` VARCHAR(255) NOT NULL,
	`address` VARCHAR(255),
	`description` TEXT,
	`floor_type` ENUM('parket', 'plocice', 'beton') NOT NULL DEFAULT 'parket',
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_venues_owner_id`
ON `venues` (`owner_id`);
CREATE TABLE IF NOT EXISTS `waiters` (
	`user_id` VARCHAR(8),
	`venue_id` VARCHAR(64) NOT NULL,
	`staff_role` VARCHAR(64) NOT NULL DEFAULT 'Konobar',
	`gender` ENUM('male', 'female', 'other') NOT NULL DEFAULT 'other',
	`birthday` DATE,
	`salary` DECIMAL(10,2) CHECK(`salary` IS null OR `salary` >= 0),
	`shift_type` VARCHAR(64),
	`rating` DECIMAL(3,2) NOT NULL DEFAULT 0 CHECK(`rating` >= 0 AND `rating` <= 5),
	`note` TEXT,
	`employed_at` DATE,
	`active` TINYINT NOT NULL DEFAULT 1,
	PRIMARY KEY(`user_id`)
);


CREATE INDEX `idx_waiters_venue_id`
ON `waiters` (`venue_id`);
CREATE INDEX `idx_waiters_staff_role`
ON `waiters` (`staff_role`);
CREATE INDEX `idx_waiters_active`
ON `waiters` (`active`);
CREATE TABLE IF NOT EXISTS `user_sessions` (
	`id` VARCHAR(64),
	`user_id` VARCHAR(8) NOT NULL,
	`device_id` VARCHAR(64),
	`token` VARCHAR(255) NOT NULL UNIQUE,
	`expires_at` DATETIME NOT NULL,
	`meta` JSON DEFAULT ('{}'),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `user_devices` (
	`id` VARCHAR(64),
	`user_id` VARCHAR(8) NOT NULL,
	`device_name` VARCHAR(255),
	`device_secret_hash` VARCHAR(255),
	`public_key` TEXT,
	`last_used_at` DATETIME,
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
	`id` VARCHAR(64),
	`user_id` VARCHAR(8) NOT NULL,
	`token` VARCHAR(16) NOT NULL,
	`expires_at` DATETIME NOT NULL,
	`used` TINYINT NOT NULL DEFAULT 0,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `venue_sectors` (
	`id` VARCHAR(64),
	`venue_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(128) NOT NULL,
	`emoji` VARCHAR(16) NOT NULL DEFAULT '🏠',
	`description` TEXT,
	`position_x` DECIMAL(10,2),
	`position_y` DECIMAL(10,2),
	`width` DECIMAL(10,2),
	`height` DECIMAL(10,2),
	`display_order` INTEGER NOT NULL DEFAULT 0,
	`active` TINYINT NOT NULL DEFAULT 1,
	PRIMARY KEY(`id`)
);


CREATE UNIQUE INDEX `venue_sectors_unique_active_name`
ON `venue_sectors` (`venue_id`, (LOWER(`name`)));
CREATE TABLE IF NOT EXISTS `venue_tables` (
	`id` VARCHAR(64),
	`sector_id` VARCHAR(64) NOT NULL,
	`table_number` VARCHAR(32) NOT NULL,
	`capacity` INTEGER NOT NULL CHECK(`capacity` > 0),
	`shape` ENUM('round', 'square', 'rectangle') NOT NULL DEFAULT 'round',
	`status` ENUM('free', 'occupied', 'waiting_order', 'in_preparation', 'waiting_payment', 'reserved', 'inactive') NOT NULL DEFAULT 'free',
	`position_x` DECIMAL(10,2),
	`position_y` DECIMAL(10,2),
	`width` DECIMAL(10,2),
	`height` DECIMAL(10,2),
	`qr_token` VARCHAR(255) NOT NULL,
	`qr_url` TEXT NOT NULL,
	`qr_generated_at` DATETIME NOT NULL,
	`active` TINYINT NOT NULL DEFAULT 1,
	PRIMARY KEY(`id`)
);


CREATE UNIQUE INDEX `venue_tables_unique_active_number`
ON `venue_tables` (`sector_id`, `table_number`);
CREATE INDEX `idx_venue_tables_status`
ON `venue_tables` (`status`);
CREATE INDEX `idx_venue_tables_shape`
ON `venue_tables` (`shape`);
CREATE TABLE IF NOT EXISTS `menu_categories` (
	`id` VARCHAR(64),
	`venue_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(128) NOT NULL,
	`emoji` VARCHAR(16) NOT NULL DEFAULT '🍽️',
	`description` TEXT,
	`display_order` INTEGER NOT NULL DEFAULT 0,
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE UNIQUE INDEX `menu_categories_unique_active_name`
ON `menu_categories` (`venue_id`, (LOWER(`name`)));
CREATE TABLE IF NOT EXISTS `menu_items` (
	`id` VARCHAR(64),
	`category_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(255) NOT NULL,
	`description` TEXT,
	`composition` TEXT,
	`price` DECIMAL(10,2) NOT NULL CHECK(`price` >= 0),
	`image` TEXT,
	`estimated_preparation_minutes` INTEGER CHECK(`estimated_preparation_minutes` IS null OR `estimated_preparation_minutes` >= 0),
	`active` TINYINT NOT NULL DEFAULT 1,
	`available` TINYINT NOT NULL DEFAULT 1,
	PRIMARY KEY(`id`)
);


CREATE UNIQUE INDEX `menu_items_unique_active_name_per_category`
ON `menu_items` (`category_id`, (LOWER(`name`)));
CREATE INDEX `idx_menu_items_category_id`
ON `menu_items` (`category_id`);
CREATE INDEX `idx_menu_items_available`
ON `menu_items` (`available`);
CREATE TABLE IF NOT EXISTS `menu_item_price_history` (
	`id` VARCHAR(64),
	`menu_item_id` VARCHAR(64) NOT NULL,
	`old_price` DECIMAL(10,2) NOT NULL CHECK(`old_price` >= 0),
	`new_price` DECIMAL(10,2) NOT NULL CHECK(`new_price` >= 0),
	`changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`changed_by` VARCHAR(8),
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `menu_item_option_groups` (
	`id` VARCHAR(64),
	`menu_item_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(128) NOT NULL,
	`required` TINYINT NOT NULL DEFAULT 0,
	`min_choices` INTEGER NOT NULL DEFAULT 0 CHECK(`min_choices` >= 0),
	`max_choices` INTEGER CHECK(`max_choices` IS null OR `max_choices` >= 0),
	`display_order` INTEGER NOT NULL DEFAULT 0,
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_option_groups_menu_item_id`
ON `menu_item_option_groups` (`menu_item_id`);
CREATE TABLE IF NOT EXISTS `menu_item_options` (
	`id` VARCHAR(64),
	`option_group_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(128) NOT NULL,
	`extra_price` DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(`extra_price` >= 0),
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_menu_item_options_option_group_id`
ON `menu_item_options` (`option_group_id`);
CREATE TABLE IF NOT EXISTS `ingredients` (
	`id` VARCHAR(64),
	`venue_id` VARCHAR(64) NOT NULL,
	`name` VARCHAR(128) NOT NULL,
	`unit` ENUM('g', 'kg', 'ml', 'l', 'pcs') NOT NULL,
	`current_quantity` DECIMAL NOT NULL,
	`minimum_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK(`minimum_quantity` >= 0),
	`active` TINYINT NOT NULL DEFAULT 1,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `menu_item_recipes` (
	`id` VARCHAR(64),
	`menu_item_id` VARCHAR(64) NOT NULL,
	`ingredient_id` VARCHAR(64) NOT NULL,
	`quantity` DECIMAL(12,3) NOT NULL CHECK(`quantity` > 0),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `ingredient_transactions` (
	`id` VARCHAR(64),
	`ingredient_id` VARCHAR(64) NOT NULL,
	`venue_id` VARCHAR(64) NOT NULL,
	`type` ENUM('procurement', 'sale', 'adjustment', 'loss') NOT NULL,
	`quantity` DECIMAL(12,3) NOT NULL CHECK(`quantity` > 0),
	`notes` TEXT,
	`created_by` VARCHAR(8),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_ingredient_transactions_ingredient_id`
ON `ingredient_transactions` (`ingredient_id`);
CREATE INDEX `idx_ingredient_transactions_created_at`
ON `ingredient_transactions` (`created_at`);
CREATE TABLE IF NOT EXISTS `table_sessions` (
	`id` VARCHAR(64),
	`table_id` VARCHAR(64) NOT NULL,
	`current_waiter_id` VARCHAR(8),
	`group_id` VARCHAR(64),
	`status` ENUM('active', 'waiting_payment', 'closed', 'cancelled') NOT NULL DEFAULT 'active',
	`opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`closed_at` DATETIME,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_table_sessions_table_id`
ON `table_sessions` (`table_id`);
CREATE INDEX `idx_table_sessions_status`
ON `table_sessions` (`status`);
CREATE INDEX `idx_table_sessions_opened_at`
ON `table_sessions` (`opened_at`);
CREATE TABLE IF NOT EXISTS `table_session_guests` (
	`id` VARCHAR(64),
	`table_session_id` VARCHAR(64) NOT NULL,
	`guest_id` VARCHAR(8),
	`anonymous_token` VARCHAR(255),
	`display_name` VARCHAR(128),
	`type` ENUM('registered', 'anonymous') NOT NULL,
	`joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`left_at` DATETIME,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_table_session_guests_session_id`
ON `table_session_guests` (`table_session_id`);
CREATE INDEX `idx_table_session_guests_guest_id`
ON `table_session_guests` (`guest_id`);
CREATE TABLE IF NOT EXISTS `friend_requests` (
	`id` VARCHAR(64),
	`sender_id` VARCHAR(8) NOT NULL,
	`receiver_id` VARCHAR(8) NOT NULL,
	`status` ENUM('pending', 'accepted', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
	`sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`responded_at` DATETIME,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_friend_requests_receiver_id`
ON `friend_requests` (`receiver_id`);
CREATE INDEX `idx_friend_requests_sender_id`
ON `friend_requests` (`sender_id`);
CREATE TABLE IF NOT EXISTS `friendships` (
	`id` VARCHAR(64),
	`guest1_id` VARCHAR(8) NOT NULL,
	`guest2_id` VARCHAR(8) NOT NULL,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE UNIQUE INDEX `friendships_unique_pair`
ON `friendships` (`guest1_id`, `guest2_id`);
CREATE TABLE IF NOT EXISTS `guest_groups` (
	`id` VARCHAR(64),
	`owner_guest_id` VARCHAR(8) NOT NULL,
	`table_session_id` VARCHAR(64),
	`status` ENUM('active', 'closed') NOT NULL DEFAULT 'active',
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`closed_at` DATETIME,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_guest_groups_owner_guest_id`
ON `guest_groups` (`owner_guest_id`);
CREATE TABLE IF NOT EXISTS `guest_group_members` (
	`id` VARCHAR(64),
	`group_id` VARCHAR(64) NOT NULL,
	`guest_id` VARCHAR(8) NOT NULL,
	`status` ENUM('invited', 'accepted', 'rejected', 'left') NOT NULL DEFAULT 'invited',
	`invited_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`joined_at` DATETIME,
	`left_at` DATETIME,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_guest_group_members_group_id`
ON `guest_group_members` (`group_id`);
CREATE INDEX `idx_guest_group_members_guest_id`
ON `guest_group_members` (`guest_id`);
CREATE TABLE IF NOT EXISTS `orders` (
	`id` VARCHAR(64),
	`table_session_id` VARCHAR(64) NOT NULL,
	`reservation_id` VARCHAR(64),
	`created_by_table_guest_id` VARCHAR(64),
	`created_by_waiter_id` VARCHAR(8),
	`approved_by_waiter_id` VARCHAR(8),
	`creation_type` ENUM('guest', 'waiter', 'preorder') NOT NULL,
	`status` ENUM('draft', 'pending_approval', 'approved', 'partial', 'rejected', 'in_preparation', 'ready', 'served', 'cancelled') NOT NULL DEFAULT 'draft',
	`note` TEXT,
	`rejection_reason` TEXT,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`approved_at` DATETIME,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_orders_table_session_id`
ON `orders` (`table_session_id`);
CREATE INDEX `idx_orders_status`
ON `orders` (`status`);
CREATE INDEX `idx_orders_created_at`
ON `orders` (`created_at`);
CREATE TABLE IF NOT EXISTS `order_items` (
	`id` VARCHAR(64),
	`order_id` VARCHAR(64) NOT NULL,
	`menu_item_id` VARCHAR(64) NOT NULL,
	`table_guest_id` VARCHAR(64),
	`quantity` INTEGER NOT NULL CHECK(`quantity` > 0),
	`unit_price` DECIMAL(10,2) NOT NULL CHECK(`unit_price` >= 0),
	`total_price` DECIMAL(10,2) NOT NULL CHECK(`total_price` >= 0),
	`note` TEXT,
	`status` ENUM('pending_approval', 'approved', 'rejected', 'in_preparation', 'ready', 'served', 'cancelled') NOT NULL DEFAULT 'pending_approval',
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_order_items_order_id`
ON `order_items` (`order_id`);
CREATE INDEX `idx_order_items_status`
ON `order_items` (`status`);
CREATE INDEX `idx_order_items_table_guest_id`
ON `order_items` (`table_guest_id`);
CREATE TABLE IF NOT EXISTS `order_item_options` (
	`id` VARCHAR(64),
	`order_item_id` VARCHAR(64) NOT NULL,
	`menu_item_option_id` VARCHAR(64),
	`option_name_snapshot` VARCHAR(128) NOT NULL,
	`extra_price_snapshot` DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(`extra_price_snapshot` >= 0),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_order_item_options_order_item_id`
ON `order_item_options` (`order_item_id`);
CREATE TABLE IF NOT EXISTS `bills` (
	`id` VARCHAR(64),
	`table_session_id` VARCHAR(64) NOT NULL,
	`status` ENUM('open', 'partially_paid', 'paid', 'cancelled') NOT NULL DEFAULT 'open',
	`total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(`total_amount` >= 0),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`closed_at` DATETIME,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `payments` (
	`id` VARCHAR(255),
	`bill_id` VARCHAR(64),
	`reservation_id` VARCHAR(64),
	`table_guest_id` VARCHAR(64),
	`waiter_id` VARCHAR(8),
	`method` ENUM('card', 'cash') NOT NULL,
	`type` ENUM('whole_bill', 'own_items', 'equal_split', 'custom_amount', 'deposit', 'preorder') NOT NULL,
	`status` ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
	`amount` DECIMAL(10,2) NOT NULL CHECK(`amount` >= 0),
	`provider_reference` VARCHAR(255),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`confirmed_at` DATETIME,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_payments_bill_id`
ON `payments` (`bill_id`);
CREATE INDEX `idx_payments_reservation_id`
ON `payments` (`reservation_id`);
CREATE INDEX `idx_payments_status`
ON `payments` (`status`);
CREATE INDEX `idx_payments_created_at`
ON `payments` (`created_at`);
CREATE TABLE IF NOT EXISTS `payment_order_items` (
	`id` VARCHAR(64),
	`payment_id` VARCHAR(255) NOT NULL,
	`order_item_id` VARCHAR(64) NOT NULL,
	`amount` DECIMAL(10,2) NOT NULL CHECK(`amount` >= 0),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_payment_order_items_order_item_id`
ON `payment_order_items` (`order_item_id`);
CREATE TABLE IF NOT EXISTS `reservations` (
	`id` VARCHAR(64),
	`guest_id` VARCHAR(8) NOT NULL,
	`venue_id` VARCHAR(64) NOT NULL,
	`table_id` VARCHAR(64) NOT NULL,
	`number_of_people` INTEGER NOT NULL CHECK(`number_of_people` > 0),
	`starts_at` DATETIME NOT NULL,
	`ends_at` DATETIME NOT NULL,
	`status` ENUM('pending', 'confirmed', 'rejected', 'cancelled', 'no_show', 'completed') NOT NULL DEFAULT 'pending',
	`deposit_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(`deposit_amount` >= 0),
	`cancellation_deadline` DATETIME,
	`confirmed_by` VARCHAR(8),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_reservations_guest_id`
ON `reservations` (`guest_id`);
CREATE INDEX `idx_reservations_venue_id`
ON `reservations` (`venue_id`);
CREATE INDEX `idx_reservations_table_id`
ON `reservations` (`table_id`);
CREATE INDEX `idx_reservations_starts_at`
ON `reservations` (`starts_at`);
CREATE INDEX `idx_reservations_status`
ON `reservations` (`status`);
CREATE TABLE IF NOT EXISTS `guest_requests` (
	`id` VARCHAR(64),
	`table_session_id` VARCHAR(64) NOT NULL,
	`table_guest_id` VARCHAR(64),
	`type` ENUM('call_waiter', 'request_bill', 'help', 'other') NOT NULL,
	`status` ENUM('new', 'in_progress', 'resolved', 'cancelled') NOT NULL DEFAULT 'new',
	`message` TEXT,
	`resolved_by_waiter_id` VARCHAR(8),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`resolved_at` DATETIME,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_guest_requests_session_id`
ON `guest_requests` (`table_session_id`);
CREATE INDEX `idx_guest_requests_status`
ON `guest_requests` (`status`);
CREATE INDEX `idx_guest_requests_created_at`
ON `guest_requests` (`created_at`);
CREATE TABLE IF NOT EXISTS `waiter_shifts` (
	`id` VARCHAR(64),
	`waiter_id` VARCHAR(8) NOT NULL,
	`venue_id` VARCHAR(64) NOT NULL,
	`sector_id` VARCHAR(64),
	`shift_type` ENUM('Jutarnja', 'Popodnevna', 'Večernja', 'Drugo') NOT NULL DEFAULT 'Jutarnja',
	`status` ENUM('confirmed', 'pending', 'cancelled') NOT NULL DEFAULT 'confirmed',
	`shift_start` DATETIME NOT NULL,
	`shift_end` DATETIME,
	`note` TEXT,
	`created_by` VARCHAR(8) NOT NULL,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_waiter_shifts_waiter_id`
ON `waiter_shifts` (`waiter_id`);
CREATE INDEX `idx_waiter_shifts_venue_id`
ON `waiter_shifts` (`venue_id`);
CREATE INDEX `idx_waiter_shifts_start`
ON `waiter_shifts` (`shift_start`);
CREATE INDEX `idx_waiter_shifts_sector_id`
ON `waiter_shifts` (`sector_id`);
CREATE INDEX `idx_waiter_shifts_status`
ON `waiter_shifts` (`status`);
CREATE TABLE IF NOT EXISTS `table_assignments` (
	`id` VARCHAR(64),
	`table_session_id` VARCHAR(64) NOT NULL,
	`waiter_id` VARCHAR(8) NOT NULL,
	`assigned_from` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`assigned_to` DATETIME,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_table_assignments_session_id`
ON `table_assignments` (`table_session_id`);
CREATE INDEX `idx_table_assignments_waiter_id`
ON `table_assignments` (`waiter_id`);
CREATE TABLE IF NOT EXISTS `waiter_revenue_goals` (
	`id` VARCHAR(64),
	`waiter_id` VARCHAR(8),
	`venue_id` VARCHAR(64) NOT NULL,
	`target_mode` ENUM('all', 'single', 'multiple') NOT NULL DEFAULT 'single',
	`target_metric` ENUM('revenue', 'orders', 'tables') NOT NULL DEFAULT 'revenue',
	`period_start` DATE NOT NULL,
	`period_end` DATE NOT NULL,
	`target_revenue` DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(`target_revenue` >= 0),
	`target_order_count` INTEGER CHECK(`target_order_count` IS null OR `target_order_count` >= 0),
	`target_table_count` INTEGER CHECK(`target_table_count` IS null OR `target_table_count` >= 0),
	`bonus` VARCHAR(255),
	`created_by` VARCHAR(8) NOT NULL,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_waiter_revenue_goals_metric`
ON `waiter_revenue_goals` (`target_metric`);
CREATE INDEX `idx_waiter_revenue_goals_period`
ON `waiter_revenue_goals` (`period_start`, `period_end`);


CREATE TABLE IF NOT EXISTS `waiter_goal_members` (
	`id` VARCHAR(64),
	`goal_id` VARCHAR(64) NOT NULL,
	`waiter_id` VARCHAR(8) NOT NULL,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`),
	UNIQUE KEY `uq_waiter_goal_members_goal_waiter` (`goal_id`, `waiter_id`)
);


CREATE INDEX `idx_waiter_goal_members_goal_id`
ON `waiter_goal_members` (`goal_id`);
CREATE INDEX `idx_waiter_goal_members_waiter_id`
ON `waiter_goal_members` (`waiter_id`);

CREATE TABLE IF NOT EXISTS `waiter_ratings` (
	`id` VARCHAR(64),
	`waiter_id` VARCHAR(8) NOT NULL,
	`venue_id` VARCHAR(64) NOT NULL,
	`rating` DECIMAL(3,2) NOT NULL CHECK(`rating` >= 1 AND `rating` <= 5),
	`source_type` ENUM('guest', 'owner', 'manager', 'system') NOT NULL DEFAULT 'guest',
	`source_user_id` VARCHAR(8),
	`order_id` VARCHAR(64),
	`table_session_id` VARCHAR(64),
	`comment` TEXT,
	`rated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_waiter_ratings_waiter_id`
ON `waiter_ratings` (`waiter_id`);
CREATE INDEX `idx_waiter_ratings_venue_id`
ON `waiter_ratings` (`venue_id`);
CREATE INDEX `idx_waiter_ratings_rated_at`
ON `waiter_ratings` (`rated_at`);

CREATE TABLE IF NOT EXISTS `notifications` (
	`id` VARCHAR(64),
	`user_id` VARCHAR(8) NOT NULL,
	`type` ENUM('friend_request', 'group_invite', 'order_status', 'reservation', 'payment', 'system') NOT NULL,
	`title` VARCHAR(255) NOT NULL,
	`content` TEXT NOT NULL,
	`read` TINYINT NOT NULL DEFAULT 0,
	`reference_type` VARCHAR(64),
	`reference_id` VARCHAR(64),
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_notifications_user_id`
ON `notifications` (`user_id`);
CREATE INDEX `idx_notifications_read`
ON `notifications` (`read`);
CREATE INDEX `idx_notifications_created_at`
ON `notifications` (`created_at`);
CREATE TABLE IF NOT EXISTS `manager` (
	`user_id` VARCHAR(8) NOT NULL,
	`venue_id` VARCHAR(64) NOT NULL,
	`active` TINYINT NOT NULL,
	`employed_at` DATE NOT NULL,
	PRIMARY KEY(`user_id`)
);


ALTER TABLE `owners`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `guests`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `venues`
ADD FOREIGN KEY(`owner_id`) REFERENCES `owners`(`user_id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `waiters`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `waiters`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `user_sessions`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `user_devices`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `password_reset_tokens`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `venue_sectors`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `venue_tables`
ADD FOREIGN KEY(`sector_id`) REFERENCES `venue_sectors`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_categories`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_items`
ADD FOREIGN KEY(`category_id`) REFERENCES `menu_categories`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `menu_item_price_history`
ADD FOREIGN KEY(`menu_item_id`) REFERENCES `menu_items`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_item_price_history`
ADD FOREIGN KEY(`changed_by`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `menu_item_option_groups`
ADD FOREIGN KEY(`menu_item_id`) REFERENCES `menu_items`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_item_options`
ADD FOREIGN KEY(`option_group_id`) REFERENCES `menu_item_option_groups`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `ingredients`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_item_recipes`
ADD FOREIGN KEY(`menu_item_id`) REFERENCES `menu_items`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `menu_item_recipes`
ADD FOREIGN KEY(`ingredient_id`) REFERENCES `ingredients`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `ingredient_transactions`
ADD FOREIGN KEY(`ingredient_id`) REFERENCES `ingredients`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `ingredient_transactions`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `table_sessions`
ADD FOREIGN KEY(`table_id`) REFERENCES `venue_tables`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `table_sessions`
ADD FOREIGN KEY(`current_waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `table_session_guests`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `table_session_guests`
ADD FOREIGN KEY(`guest_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `friend_requests`
ADD FOREIGN KEY(`sender_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `friend_requests`
ADD FOREIGN KEY(`receiver_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `friendships`
ADD FOREIGN KEY(`guest1_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `friendships`
ADD FOREIGN KEY(`guest2_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
-- orders.reservation_id → reservations.id
ALTER TABLE `orders`
ADD FOREIGN KEY(`reservation_id`) REFERENCES `reservations`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `guest_groups`
ADD FOREIGN KEY(`owner_guest_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `guest_groups`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `guest_group_members`
ADD FOREIGN KEY(`group_id`) REFERENCES `guest_groups`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `guest_group_members`
ADD FOREIGN KEY(`guest_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `orders`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `orders`
ADD FOREIGN KEY(`created_by_table_guest_id`) REFERENCES `table_session_guests`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `orders`
ADD FOREIGN KEY(`created_by_waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `orders`
ADD FOREIGN KEY(`approved_by_waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `order_items`
ADD FOREIGN KEY(`order_id`) REFERENCES `orders`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `order_items`
ADD FOREIGN KEY(`menu_item_id`) REFERENCES `menu_items`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `order_items`
ADD FOREIGN KEY(`table_guest_id`) REFERENCES `table_session_guests`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `order_item_options`
ADD FOREIGN KEY(`order_item_id`) REFERENCES `order_items`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `order_item_options`
ADD FOREIGN KEY(`menu_item_option_id`) REFERENCES `menu_item_options`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `bills`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `payments`
ADD FOREIGN KEY(`bill_id`) REFERENCES `bills`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `payments`
ADD FOREIGN KEY(`table_guest_id`) REFERENCES `table_session_guests`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `payments`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `payment_order_items`
ADD FOREIGN KEY(`payment_id`) REFERENCES `payments`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `payment_order_items`
ADD FOREIGN KEY(`order_item_id`) REFERENCES `order_items`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `reservations`
ADD FOREIGN KEY(`guest_id`) REFERENCES `guests`(`user_id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `reservations`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `reservations`
ADD FOREIGN KEY(`table_id`) REFERENCES `venue_tables`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `guest_requests`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `guest_requests`
ADD FOREIGN KEY(`table_guest_id`) REFERENCES `table_session_guests`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `guest_requests`
ADD FOREIGN KEY(`resolved_by_waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `waiter_shifts`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_shifts`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_shifts`
ADD FOREIGN KEY(`sector_id`) REFERENCES `venue_sectors`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `table_assignments`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `table_assignments`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE `waiter_revenue_goals`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `waiter_revenue_goals`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_goal_members`
ADD FOREIGN KEY(`goal_id`) REFERENCES `waiter_revenue_goals`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_goal_members`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_ratings`
ADD FOREIGN KEY(`waiter_id`) REFERENCES `waiters`(`user_id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_ratings`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
ALTER TABLE `waiter_ratings`
ADD FOREIGN KEY(`source_user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `waiter_ratings`
ADD FOREIGN KEY(`order_id`) REFERENCES `orders`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `waiter_ratings`
ADD FOREIGN KEY(`table_session_id`) REFERENCES `table_sessions`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
ALTER TABLE `notifications`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;
-- table_sessions.group_id → guest_groups.id
ALTER TABLE `table_sessions`
ADD FOREIGN KEY(`group_id`) REFERENCES `guest_groups`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
-- manager.user_id → users.id
ALTER TABLE `manager`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
-- manager.venue_id → venues.id
ALTER TABLE `manager`
ADD FOREIGN KEY(`venue_id`) REFERENCES `venues`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
-- waiter_revenue_goals.created_by → users.id
ALTER TABLE `waiter_revenue_goals`
ADD FOREIGN KEY(`created_by`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
-- reservations.confirmed_by → owners.user_id
ALTER TABLE `reservations`
ADD FOREIGN KEY(`confirmed_by`) REFERENCES `owners`(`user_id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
-- ingredient_transactions.created_by → users.id
ALTER TABLE `ingredient_transactions`
ADD FOREIGN KEY(`created_by`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE SET NULL;
-- waiter_shifts.created_by → users.id
ALTER TABLE `waiter_shifts`
ADD FOREIGN KEY(`created_by`) REFERENCES `users`(`id`)
ON UPDATE RESTRICT ON DELETE RESTRICT;
-- payments.reservation_id → reservations.id
ALTER TABLE `payments`
ADD FOREIGN KEY(`reservation_id`) REFERENCES `reservations`(`id`)
ON UPDATE RESTRICT ON DELETE CASCADE;