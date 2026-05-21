CREATE TABLE "daily_snapshots" (
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "daily_snapshots_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_state" (
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"checked" jsonb DEFAULT '{}'::jsonb,
	"sub_checked" jsonb DEFAULT '{}'::jsonb,
	"skipped" jsonb DEFAULT '{}'::jsonb,
	"client_id" uuid DEFAULT gen_random_uuid(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "daily_state_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "checked_is_object" CHECK (jsonb_typeof("daily_state"."checked") = 'object'),
	CONSTRAINT "sub_checked_is_object" CHECK (jsonb_typeof("daily_state"."sub_checked") = 'object'),
	CONSTRAINT "skipped_is_object" CHECK (jsonb_typeof("daily_state"."skipped") = 'object')
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"icon" text,
	"title" text NOT NULL,
	"category" text,
	"color" text,
	"shifts" jsonb DEFAULT '[]'::jsonb,
	"time_block" text,
	"is_warning" boolean DEFAULT false,
	"recurrence" "recurrence_enum",
	"target_date" date,
	"alert_time" text,
	"is_prayer_task" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"subtasks" jsonb DEFAULT '[]'::jsonb,
	"brief" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "subtasks_is_array" CHECK (jsonb_typeof("tasks"."subtasks") = 'array' OR "tasks"."subtasks" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_state" ADD CONSTRAINT "daily_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_snapshots_date" ON "daily_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_daily_state_updated_at" ON "daily_state" USING btree ("updated_at");