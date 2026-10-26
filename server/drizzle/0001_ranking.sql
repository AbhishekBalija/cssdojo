CREATE TYPE "public"."event_kind" AS ENUM('moved', 'number-one', 'pack-top3', 'belt', 'pack-open');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('passed', 'badge', 'belt', 'pack-open', 'pack-soon');--> statement-breakpoint
CREATE TABLE "answer_locks" (
	"player_id" uuid NOT NULL,
	"challenge_id" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "event_kind" NOT NULL,
	"player_id" uuid,
	"board" text NOT NULL,
	"text" text NOT NULL,
	"delta" integer,
	"rank" integer,
	"href" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kata_days" (
	"player_id" uuid NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"board" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_follows" (
	"player_id" uuid NOT NULL,
	"pack_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_results" (
	"pack_number" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"solved" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"number" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"belt" "belt" NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"soon_sent_at" timestamp with time zone,
	"opened_sent_at" timestamp with time zone,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "player_badges" (
	"player_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_settings" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"notify_passed" boolean DEFAULT true NOT NULL,
	"notify_pack_open" boolean DEFAULT true NOT NULL,
	"notify_badge" boolean DEFAULT true NOT NULL,
	"show_live" boolean DEFAULT true NOT NULL,
	"handle_changed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "best_scores" ADD COLUMN "points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "pack_number" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "ranking" jsonb;--> statement-breakpoint
ALTER TABLE "answer_locks" ADD CONSTRAINT "answer_locks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_locks" ADD CONSTRAINT "answer_locks_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kata_days" ADD CONSTRAINT "kata_days_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_follows" ADD CONSTRAINT "pack_follows_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_follows" ADD CONSTRAINT "pack_follows_pack_number_packs_number_fk" FOREIGN KEY ("pack_number") REFERENCES "public"."packs"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_results" ADD CONSTRAINT "pack_results_pack_number_packs_number_fk" FOREIGN KEY ("pack_number") REFERENCES "public"."packs"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_results" ADD CONSTRAINT "pack_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_badges" ADD CONSTRAINT "player_badges_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_settings" ADD CONSTRAINT "player_settings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_locks_unique" ON "answer_locks" USING btree ("player_id","challenge_id");--> statement-breakpoint
CREATE INDEX "events_board" ON "events" USING btree ("board","created_at");--> statement-breakpoint
CREATE INDEX "events_created" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kata_days_unique" ON "kata_days" USING btree ("player_id","date");--> statement-breakpoint
CREATE INDEX "notifications_player" ON "notifications" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_follows_unique" ON "pack_follows" USING btree ("player_id","pack_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_results_unique" ON "pack_results" USING btree ("pack_number","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_badges_unique" ON "player_badges" USING btree ("player_id","badge_id");--> statement-breakpoint
-- Backfill: every day a player already has a kata best counts as a streak day.
INSERT INTO "kata_days" ("player_id", "date") SELECT DISTINCT "player_id", "kata_date" FROM "best_scores" WHERE "kata_date" IS NOT NULL ON CONFLICT DO NOTHING;
