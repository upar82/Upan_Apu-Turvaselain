CREATE TABLE "devices" (
	"device_id" text PRIMARY KEY NOT NULL,
	"pair_code" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "devices_pair_code_unique" UNIQUE("pair_code")
);
