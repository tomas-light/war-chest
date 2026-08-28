CREATE TABLE "active_game_players" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_game_players" ADD CONSTRAINT "active_game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "active_game_players" ADD CONSTRAINT "active_game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "active_game_players_game_id_index" ON "active_game_players" USING btree ("game_id");
