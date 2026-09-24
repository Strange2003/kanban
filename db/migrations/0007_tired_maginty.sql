CREATE TABLE "work_item_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"work_item_id" integer NOT NULL,
	"author_user_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_comments_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "work_item_comments_body_check" CHECK (length(btrim("work_item_comments"."body")) BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "work_item_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"work_item_id" integer NOT NULL,
	"author_user_id" text NOT NULL,
	"author_name" text NOT NULL,
	"minutes" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_time_entries_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "work_item_time_entries_minutes_check" CHECK ("work_item_time_entries"."minutes" BETWEEN 1 AND 600000),
	CONSTRAINT "work_item_time_entries_note_check" CHECK ("work_item_time_entries"."note" IS NULL OR length("work_item_time_entries"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "work_item_comments" ADD CONSTRAINT "work_item_comments_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_time_entries" ADD CONSTRAINT "work_item_time_entries_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_comments_item_created_idx" ON "work_item_comments" USING btree ("work_item_id","created_at","id");--> statement-breakpoint
CREATE INDEX "work_item_time_entries_item_created_idx" ON "work_item_time_entries" USING btree ("work_item_id","created_at","id");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_estimate_minutes_check" CHECK ("work_items"."estimate_minutes" IS NULL OR "work_items"."estimate_minutes" BETWEEN 0 AND 600000);