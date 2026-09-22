ALTER TYPE "public"."project_role" ADD VALUE 'viewer';--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "role" "project_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_one_owner_idx" ON "project_members" USING btree ("project_id") WHERE "project_members"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_not_owner_check" CHECK ("invitations"."role" <> 'owner');