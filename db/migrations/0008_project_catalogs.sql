-- 013-project-catalogs (data-model.md § Migración 0008). Hand-written: drizzle-kit
-- can only express the iterations → sizes rename interactively, and a DROP +
-- CREATE would lose every Work Item's value (FR-016).
CREATE TYPE "public"."tag_color" AS ENUM('gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink');--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "color" "tag_color" DEFAULT 'gray' NOT NULL;--> statement-breakpoint
ALTER TABLE "iterations" RENAME TO "sizes";--> statement-breakpoint
ALTER SEQUENCE "iterations_id_seq" RENAME TO "sizes_id_seq";--> statement-breakpoint
ALTER TABLE "sizes" RENAME CONSTRAINT "iterations_pkey" TO "sizes_pkey";--> statement-breakpoint
ALTER TABLE "sizes" RENAME CONSTRAINT "iterations_project_id_projects_id_fk" TO "sizes_project_id_projects_id_fk";--> statement-breakpoint
ALTER INDEX "iterations_project_lower_name_idx" RENAME TO "sizes_project_lower_name_idx";--> statement-breakpoint
ALTER TABLE "work_items" RENAME COLUMN "iteration_id" TO "size_id";--> statement-breakpoint
ALTER TABLE "work_items" RENAME CONSTRAINT "work_items_iteration_id_iterations_id_fk" TO "work_items_size_id_sizes_id_fk";--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "tags" SET "position" = r.rn FROM (SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY lower("name"), "id") - 1 AS rn FROM "tags") r WHERE "tags"."id" = r."id";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "areas" SET "position" = r.rn FROM (SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY lower("name"), "id") - 1 AS rn FROM "areas") r WHERE "areas"."id" = r."id";--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sizes" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "sizes" SET "position" = r.rn FROM (SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY lower("name"), "id") - 1 AS rn FROM "sizes") r WHERE "sizes"."id" = r."id";--> statement-breakpoint
ALTER TABLE "sizes" ALTER COLUMN "position" SET NOT NULL;
