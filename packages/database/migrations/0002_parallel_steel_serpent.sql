TRUNCATE TABLE "games" CASCADE;--> statement-breakpoint
ALTER TABLE "game_participants" DROP CONSTRAINT "game_participants_role_position_check";--> statement-breakpoint
ALTER TABLE "game_participants" DROP CONSTRAINT "game_participants_seat_positive";--> statement-breakpoint
DROP INDEX "game_participants_user_history_index";--> statement-breakpoint
ALTER TABLE "game_participants" ALTER COLUMN "seat" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game_participants" ALTER COLUMN "team" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "game_participants_user_history_index" ON "game_participants" USING btree ("user_id","game_id");--> statement-breakpoint
ALTER TABLE "game_participants" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_seat_positive" CHECK ("game_participants"."seat" > 0);--> statement-breakpoint
DROP TYPE "public"."participant_role";
