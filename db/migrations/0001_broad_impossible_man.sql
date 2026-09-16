CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stages_project_id_idx" ON "stages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_item_activity_work_item_id_idx" ON "work_item_activity" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "work_item_tags_tag_id_idx" ON "work_item_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "work_items_project_id_idx" ON "work_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_items_stage_id_idx" ON "work_items" USING btree ("stage_id");