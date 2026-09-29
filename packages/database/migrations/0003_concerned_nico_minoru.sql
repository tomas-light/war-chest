CREATE TABLE "game_turn_drafts" (
	"action" jsonb NOT NULL,
	"base_version" integer NOT NULL,
	"coin_index" integer NOT NULL,
	"game_id" uuid PRIMARY KEY NOT NULL,
	"id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"revision" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_turn_drafts" ADD CONSTRAINT "game_turn_drafts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_turn_drafts" ADD CONSTRAINT "game_turn_drafts_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;