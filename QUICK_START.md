# دليل البدء السريع

## التشغيل المحلي

1. **انتقل إلى مجلد المشروع:**
   ```bash
   cd customer-debt-analysis
   ```

2. **تثبيت المكتبات (إذا لم تكن مثبتة):**
   ```bash
   npm install
   ```

3. **تشغيل المشروع:**
   ```bash
   npm run dev
   ```

4. **افتح المتصفح:**
   - اذهب إلى [http://localhost:3000](http://localhost:3000)

## ملاحظات مهمة

- المشروع سيقرأ ملف Service Account من `../assets/BHAPPS.json` تلقائياً في البيئة المحلية
- تأكد من أن Google Sheet متاح للقراءة من Service Account
- شارك الـ Sheet مع: `bhapps@bhapps.iam.gserviceaccount.com`

## البناء للإنتاج

```bash
npm run build
npm start
```

## استكشاف الأخطاء

إذا واجهت مشكلة في الاتصال بـ Google Sheets:
1. تحقق من أن ملف `assets/BHAPPS.json` موجود في المجلد الأب
2. تحقق من أن Service Account لديه صلاحيات على Google Sheet
3. تحقق من أن Sheet ID و Sheet Name صحيحان

