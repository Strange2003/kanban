CREATE TABLE "work_item_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"work_item_id" integer NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_item_checklist_items_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "work_item_checklist_items_text_check" CHECK (length("work_item_checklist_items"."text") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "work_item_checklist_items" ADD CONSTRAINT "work_item_checklist_items_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_item_checklist_items_item_position_idx" ON "work_item_checklist_items" USING btree ("work_item_id","position","id");