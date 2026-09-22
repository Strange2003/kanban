CREATE TABLE "work_item_related_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_item_id_a" integer NOT NULL,
	"work_item_id_b" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_related_links_distinct_check" CHECK ("work_item_related_links"."work_item_id_a" <> "work_item_related_links"."work_item_id_b")
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "parent_work_item_id" integer;--> statement-breakpoint
ALTER TABLE "work_item_related_links" ADD CONSTRAINT "work_item_related_links_work_item_id_a_work_items_id_fk" FOREIGN KEY ("work_item_id_a") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_related_links" ADD CONSTRAINT "work_item_related_links_work_item_id_b_work_items_id_fk" FOREIGN KEY ("work_item_id_b") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_related_links_pair_idx" ON "work_item_related_links" USING btree ("work_item_id_a","work_item_id_b");--> statement-breakpoint
CREATE INDEX "work_item_related_links_b_idx" ON "work_item_related_links" USING btree ("work_item_id_b");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_parent_work_item_id_work_items_id_fk" FOREIGN KEY ("parent_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_items_parent_work_item_id_idx" ON "work_items" USING btree ("parent_work_item_id");