-- إنشاء جدول خصومات وإيجارات العملاء
CREATE TABLE IF NOT EXISTS public."web_CUSTOMERS_DISCOUNTS" (
    "ID" text NOT NULL,
    "CUSTOMER_ID" text NOT NULL,
    "DISCOUNT_NAME" text NOT NULL,
    "DISCOUNT_TYPE" text NOT NULL, -- 'percentage' or 'fixed_amount'
    "DISCOUNT_VALUE" numeric NOT NULL,
    "CREATED_AT" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "web_CUSTOMERS_DISCOUNTS_pkey" PRIMARY KEY ("ID")
);

-- إنشاء جدول تسويات الشهور
CREATE TABLE IF NOT EXISTS public."web_CUSTOMERS_DISCOUNTS_SETTLEMENTS" (
    "ID" text NOT NULL,
    "CUSTOMER_ID" text NOT NULL,
    "MONTH" integer NOT NULL,
    "YEAR" integer NOT NULL,
    "STATUS" text NOT NULL DEFAULT 'Pending', -- 'Pending' or 'Settled'
    "NOTES" text,
    "CREATED_AT" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "web_CUSTOMERS_DISCOUNTS_SETTLEMENTS_pkey" PRIMARY KEY ("ID")
);
