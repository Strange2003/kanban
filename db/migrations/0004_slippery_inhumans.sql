CREATE TYPE "public"."work_item_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."work_item_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iterations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "is_closing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "priority" "work_item_priority";--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "severity" "work_item_severity";--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "area_id" integer;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "iteration_id" integer;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iterations" ADD CONSTRAINT "iterations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_project_lower_name_idx" ON "areas" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "iterations_project_lower_name_idx" ON "iterations" USING btree ("project_id",lower("name"));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_iteration_id_iterations_id_fk" FOREIGN KEY ("iteration_id") REFERENCES "public"."iterations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_dates_order_check" CHECK ("work_items"."start_date" IS NULL OR "work_items"."target_date" IS NULL OR "work_items"."target_date" >= "work_items"."start_date");