# Customer Debt Analysis Application

تطبيق تحليل مديونية العملاء - مبني بـ Next.js

## المميزات

- تحليل مديونية العملاء حسب:
  - العملاء
  - المناديب
  - السنوات
  - الشهور
- واجهة مستخدم عربية مع Sidebar و 4 tabs
- رسوم بيانية تفاعلية
- جداول قابلة للترتيب
- اتصال مباشر مع Google Sheets

## المتطلبات

- Node.js 18+
- npm أو yarn

## الإعداد المحلي

1. تثبيت المكتبات:
```bash
npm install
```

2. إعداد متغيرات البيئة:
   - انسخ `.env.example` إلى `.env.local`
   - أضف `GOOGLE_SERVICE_ACCOUNT` كسلسلة JSON واحدة

3. تشغيل المشروع:
```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

## النشر على Vercel

1. ارفع المشروع إلى GitHub
2. اربط المشروع بـ Vercel
3. أضف متغيرات البيئة في Vercel:
   - `GOOGLE_SHEET_ID`: 1s1G42Qd0FNDyvz42qi_6SPoKMAy8Kvx8eMm7iyR8pds
   - `GOOGLE_SHEET_NAME`: Invoices
   - `GOOGLE_SERVICE_ACCOUNT`: محتوى ملف BHAPPS.json كسلسلة JSON واحدة

## بنية البيانات في Google Sheets

يجب أن يحتوي Sheet على الأعمدة التالية:
- DATE
- MONTH
- CUSTOMER NAME
- DEBIT
- CREDIT
- SALESREP

## التقنيات المستخدمة

- Next.js 14+
- TypeScript
- Tailwind CSS
- Google Sheets API
- Recharts
- TanStack Table
