ALTER TABLE "devices" ADD COLUMN "pairing_otp" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "pairing_otp_expires" timestamp;
