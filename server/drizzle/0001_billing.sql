CREATE TYPE "public"."bill_status" AS ENUM('PAID', 'PARTIAL', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'UPI', 'CARD', 'EMI', 'BANK_TRANSFER', 'MIXED');--> statement-breakpoint
CREATE TABLE "bill_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"financial_year" varchar(9) NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"product_id" integer,
	"description" varchar(250) NOT NULL,
	"sku" varchar(40),
	"hsn_code" varchar(12),
	"serial_number" varchar(120),
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"gst_rate" double precision DEFAULT 0 NOT NULL,
	"taxable_paise" integer NOT NULL,
	"gst_paise" integer NOT NULL,
	"line_total_paise" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_number" varchar(60) NOT NULL,
	"public_token" varchar(40) NOT NULL,
	"branch_id" integer NOT NULL,
	"bill_date" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"customer_mobile" varchar(15) NOT NULL,
	"customer_email" varchar(255),
	"customer_address" text,
	"customer_gstin" varchar(15),
	"prices_include_gst" boolean DEFAULT true NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"taxable_paise" integer NOT NULL,
	"cgst_paise" integer DEFAULT 0 NOT NULL,
	"sgst_paise" integer DEFAULT 0 NOT NULL,
	"round_off_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"paid_paise" integer NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'CASH' NOT NULL,
	"payment_reference" varchar(120),
	"status" "bill_status" DEFAULT 'PAID' NOT NULL,
	"notes" text,
	"created_by_id" integer,
	"whatsapp_sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"cancelled_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_counters" ADD CONSTRAINT "bill_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_counters_uq" ON "bill_counters" USING btree ("branch_id","financial_year");--> statement-breakpoint
CREATE INDEX "bill_items_bill_idx" ON "bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bill_items_serial_idx" ON "bill_items" USING btree ("serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_number_uq" ON "bills" USING btree ("bill_number");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_token_uq" ON "bills" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "bills_branch_date_idx" ON "bills" USING btree ("branch_id","bill_date");--> statement-breakpoint
CREATE INDEX "bills_mobile_idx" ON "bills" USING btree ("customer_mobile");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");