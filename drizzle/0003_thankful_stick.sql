ALTER TABLE "daily_state" ADD CONSTRAINT "checked_is_object" CHECK (jsonb_typeof("daily_state"."checked") = 'object');--> statement-breakpoint
ALTER TABLE "daily_state" ADD CONSTRAINT "sub_checked_is_object" CHECK (jsonb_typeof("daily_state"."sub_checked") = 'object');--> statement-breakpoint
ALTER TABLE "daily_state" ADD CONSTRAINT "skipped_is_object" CHECK (jsonb_typeof("daily_state"."skipped") = 'object');--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "subtasks_is_array" CHECK (jsonb_typeof("tasks"."subtasks") = 'array' OR "tasks"."subtasks" IS NULL);