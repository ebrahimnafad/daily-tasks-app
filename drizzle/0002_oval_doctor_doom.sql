CREATE TYPE "public"."recurrence_enum" AS ENUM('يومي', 'مرة واحدة', 'أسبوعي', 'شهري', 'سنوي', 'كل يومين', 'أيام العمل', 'موعد محدد', 'صلاة');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "recurrence" SET DATA TYPE "public"."recurrence_enum" USING "recurrence"::"public"."recurrence_enum";--> statement-breakpoint
