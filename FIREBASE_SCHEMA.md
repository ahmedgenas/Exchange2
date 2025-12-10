# هيكل قاعدة البيانات والأدوار (Database Schema & Roles)

هذا الملف يوضح الجداول (Collections) والأدوار (Roles) التي تم تصميمها للنظام على Firebase Firestore.

## 1. الأدوار والصلاحيات (Roles)

| الدور (Role) | الوصف | الصلاحيات الرئيسية |
|---|---|---|
| `ADMIN` | مدير النظام | تحكم كامل في جميع الجداول (إضافة مستخدمين، فروع، تعديل بيانات). |
| `BRANCH_MANAGER` | مدير فرع | طلب أدوية، الموافقة على طلبات واردة، الإبلاغ عن نواقص، تعديل مخزون فرعه فقط. |
| `DISTRIBUTION` | مسئول التوزيع | رؤية جميع الطلبات الجاهزة، تعيين المناديب (Drivers)، تتبع الخريطة. |
| `DELIVERY` | مندوب توصيل | رؤية المهام الموكلة إليه فقط، تحديث حالة الطلب (استلام/تسليم)، تحديث موقعه (GPS). |
| `INVENTORY_MANAGER` | مسئول المخزون | إدارة جدول الأصناف (Products)، تعديل الأرصدة (Stocks)، حل مشاكل الجرد. |
| `SHORTAGE_MANAGER` | مسئول النواقص | رؤية بلاغات النواقص، تحديث حالتها عند توفير الصنف. |

---

## 2. جداول قاعدة البيانات (Collections)

### `users` (المستخدمين)
يحتوي على بيانات الدخول والصلاحيات.
- **Fields:** `username`, `role`, `name`, `branchId` (لمديري الفروع), `lastLocation` (للمناديب).

### `branches` (الفروع)
بيانات الصيدليات والمواقع الجغرافية.
- **Fields:** `name`, `address`, `location {lat, lng}`.

### `products` (الأصناف)
قائمة الأدوية المعرفة في النظام.
- **Fields:** `code`, `name`, `barcode`, `isFridge`.

### `stocks` (المخزون)
رصيد كل صنف في كل فرع.
- **Fields:** `branchId`, `productCode`, `quantity`.
- **ملاحظة:** يتم تحديثه تلقائياً عند اكتمال الطلبات.

### `requests` (الطلبات والتبادلات)
الجدول الرئيسي لحركة البضاعة.
- **Fields:** `requesterBranchId`, `targetBranchId`, `productCode`, `quantity`, `status`, `driverId`, `timestamps...`.
- **دورة حياة الطلب:**
  1. `PENDING`: انتظار موافقة الفرع المورد.
  2. `APPROVED`: تمت الموافقة (يظهر للتوزيع).
  3. `DISTRIBUTION`: جاهز للتعيين.
  4. `ASSIGNED`: تم تعيين مندوب.
  5. `PICKED_UP`: المندوب استلم البضاعة (في الطريق).
  6. `DELIVERED`: تم التوصيل (في انتظار تأكيد الطالب).
  7. `COMPLETED`: عملية مكتملة.

### `shortages` (النواقص)
بلاغات عن أصناف غير موجودة في الشبكة.
- **Fields:** `requesterBranchId`, `productCode`, `requestedQuantity`, `status`.

---

## 3. كيفية التطبيق (How to Apply)

1. اذهب إلى **Firebase Console** -> **Firestore Database**.
2. اختر **Rules** من القائمة العلوية.
3. انسخ محتوى الملف `firestore.rules` وضعه هناك.
4. تأكد من تفعيل **Authentication** وإضافة المستخدمين بنفس الـ `UID` المستخدم في قاعدة البيانات لضمان عمل الصلاحيات.
