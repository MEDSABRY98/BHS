# إرشادات النشر على Vercel

## خطوات النشر

1. **ارفع المشروع إلى GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **اربط المشروع بـ Vercel**
   - اذهب إلى [vercel.com](https://vercel.com)
   - اضغط على "New Project"
   - اختر المستودع من GitHub
   - اربط المشروع

3. **أضف متغيرات البيئة في Vercel**
   
   في صفحة إعدادات المشروع في Vercel، أضف المتغيرات التالية:

   - **GOOGLE_SHEET_ID**: `1s1G42Qd0FNDyvz42qi_6SPoKMAy8Kvx8eMm7iyR8pds`
   - **GOOGLE_SHEET_NAME**: `Invoices`
   - **GOOGLE_SERVICE_ACCOUNT**: 
     - افتح ملف `assets/BHAPPS.json`
     - انسخ المحتوى بالكامل
     - حوله إلى سلسلة JSON واحدة (أزل جميع الأسطر الجديدة)
     - أو استخدم أداة مثل [JSON Minifier](https://jsonformatter.org/json-minify)
     - الصق النتيجة في متغير البيئة `GOOGLE_SERVICE_ACCOUNT`

4. **نشر المشروع**
   - اضغط على "Deploy"
   - انتظر حتى يكتمل البناء
   - المشروع سيكون متاحاً على رابط Vercel

## ملاحظات مهمة

- تأكد من أن Service Account لديه صلاحيات القراءة على Google Sheet
- في Google Sheets، شارك الـ Sheet مع البريد الإلكتروني: `bhapps@bhapps.iam.gserviceaccount.com`
- تأكد من أن Sheet Name مطابق تماماً: `Invoices`

## استكشاف الأخطاء

إذا واجهت مشاكل:
1. تحقق من متغيرات البيئة في Vercel
2. تحقق من صلاحيات Service Account على Google Sheet
3. راجع سجلات الأخطاء في Vercel Dashboard

