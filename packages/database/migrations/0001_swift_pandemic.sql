CREATE TYPE "public"."card_selection_mode" AS ENUM('random', 'draft', 'eliminationDraft');--> statement-breakpoint
CREATE TYPE "public"."game_format" AS ENUM('duel', 'team');--> statement-breakpoint
DELETE FROM "games";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "card_selection_mode" "card_selection_mode" NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "expansions" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "format" "game_format" NOT NULL;
