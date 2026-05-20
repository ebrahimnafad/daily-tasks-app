ALTER TABLE "schedule_config" ADD COLUMN "off_exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_config" ADD COLUMN "work_exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_config" ADD COLUMN "vacation_days" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_config" ADD COLUMN "vacation_balance" integer DEFAULT 0 NOT NULL;