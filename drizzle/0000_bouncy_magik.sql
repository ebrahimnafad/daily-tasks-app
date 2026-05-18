-- Fresh start: erase all legacy unscoped data
TRUNCATE TABLE daily_state CASCADE;
TRUNCATE TABLE daily_snapshots CASCADE;
TRUNCATE TABLE schedule_config CASCADE;

CREATE TABLE "calendar_notes_rel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"note_date" date NOT NULL,
	"note_text" text NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
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
	CONSTRAINT "daily_state_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"monthly_budget" numeric,
	"is_custom" boolean DEFAULT false,
	"display_order" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"icon" text,
	"amount" numeric NOT NULL,
	"frequency" text,
	"expense_type" text,
	"is_active" boolean DEFAULT true,
	"due_day" integer,
	"quarter_month" integer,
	"total_amount" numeric,
	"total_installments" integer,
	"end_date" date,
	"season_month" integer,
	"monthly_set_aside" numeric,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_goals_rel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"target_amount" numeric NOT NULL,
	"current_saved" numeric DEFAULT '0',
	"deadline" date,
	"monthly_target" numeric,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_incomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"amount" numeric NOT NULL,
	"frequency" text,
	"income_type" text,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expense_id" uuid,
	"category_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"transaction_date" date NOT NULL,
	"status" text,
	"notes" text,
	"currency_symbol" text,
	"exchange_rate" numeric,
	"original_amount" numeric,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedule_config" (
	"user_id" integer NOT NULL,
	"id" integer DEFAULT 1,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" uuid DEFAULT gen_random_uuid(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "schedule_config_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"icon" text,
	"title" text NOT NULL,
	"category" text,
	"color" text,
	"shifts" jsonb DEFAULT '[]'::jsonb,
	"time_block" text,
	"is_warning" boolean DEFAULT false,
	"recurrence" text,
	"target_date" date,
	"alert_time" text,
	"is_prayer_task" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"subtasks" jsonb DEFAULT '[]'::jsonb,
	"brief" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "calendar_notes_rel" ADD CONSTRAINT "calendar_notes_rel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_state" ADD CONSTRAINT "daily_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_goals_rel" ADD CONSTRAINT "finance_goals_rel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_incomes" ADD CONSTRAINT "finance_incomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_expense_id_finance_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."finance_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_config" ADD CONSTRAINT "schedule_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_calendar_notes_updated_at" ON "calendar_notes_rel" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_daily_snapshots_date" ON "daily_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_daily_state_updated_at" ON "daily_state" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_schedule_updated_at" ON "schedule_config" USING btree ("updated_at");