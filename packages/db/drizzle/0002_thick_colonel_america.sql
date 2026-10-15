ALTER TABLE "leads" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "manager_user_id" uuid;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agencies_manager_idx" ON "agencies" USING btree ("manager_user_id");