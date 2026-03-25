ALTER TABLE "devices" ADD COLUMN "current_url" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "visit_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "pending_message" text;