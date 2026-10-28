CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_created" ON "admin_actions" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;