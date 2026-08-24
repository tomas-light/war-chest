ALTER TABLE "game_events" DROP CONSTRAINT "game_events_command_id_processed_commands_id_fk";--> statement-breakpoint
DROP TABLE "processed_commands";--> statement-breakpoint
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
ALTER TABLE "processed_commands" ADD CONSTRAINT "processed_commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_commands" ADD CONSTRAINT "processed_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_command_id_processed_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."processed_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "processed_commands_game_processed_at_index" ON "processed_commands" USING btree ("game_id","processed_at");--> statement-breakpoint
CREATE INDEX "processed_commands_user_id_index" ON "processed_commands" USING btree ("user_id");
