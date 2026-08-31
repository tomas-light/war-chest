CREATE TYPE "public"."game_status" AS ENUM('waiting', 'active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."game_team" AS ENUM('black', 'white');--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_digest" text NOT NULL,
	"request_ip_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"request_ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_registration_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"content" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_preset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_game_players" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"command_id" uuid,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_events_sequence_positive" CHECK ("game_events"."sequence" > 0),
	CONSTRAINT "game_events_version_positive" CHECK ("game_events"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"team" "game_team" NOT NULL,
	CONSTRAINT "game_participants_game_user_pk" PRIMARY KEY("game_id","user_id"),
	CONSTRAINT "game_participants_seat_positive" CHECK ("game_participants"."seat" > 0)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "game_status" DEFAULT 'waiting' NOT NULL,
	"winner_team" "game_team",
	"current_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "games_current_version_nonnegative" CHECK ("games"."current_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "processed_commands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"command_type" text NOT NULL,
	"request_hash" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_commands_request_hash_format" CHECK ("processed_commands"."request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_game_players" ADD CONSTRAINT "active_game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_game_players" ADD CONSTRAINT "active_game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_command_id_processed_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."processed_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_commands" ADD CONSTRAINT "processed_commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_commands" ADD CONSTRAINT "processed_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_index" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_index" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_login_challenges_email_created_at_index" ON "email_login_challenges" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "email_login_challenges_ip_created_at_index" ON "email_login_challenges" USING btree ("request_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "email_login_challenges_expires_at_index" ON "email_login_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_login_failures_email_created_at_index" ON "email_login_failures" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "email_login_failures_ip_created_at_index" ON "email_login_failures" USING btree ("request_ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_registration_tickets_token_hash_unique" ON "email_registration_tickets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_registration_tickets_expires_at_index" ON "email_registration_tickets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "active_game_players_game_id_index" ON "active_game_players" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_game_sequence_unique" ON "game_events" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE INDEX "game_events_command_id_index" ON "game_events" USING btree ("command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_participants_game_team_seat_unique" ON "game_participants" USING btree ("game_id","team","seat");--> statement-breakpoint
CREATE INDEX "game_participants_user_history_index" ON "game_participants" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "games_status_index" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processed_commands_game_processed_at_index" ON "processed_commands" USING btree ("game_id","processed_at");--> statement-breakpoint
CREATE INDEX "processed_commands_user_id_index" ON "processed_commands" USING btree ("user_id");