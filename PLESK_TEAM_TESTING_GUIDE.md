# คู่มือทดสอบระบบหลังอัปขึ้น Plesk สำหรับทีมตรวจสอบ

เอกสารนี้ใช้สำหรับทีมตรวจสอบที่อยู่นอกเครื่อง local และทดสอบผ่าน URL บน Plesk หรือ staging/production-like hosting เท่านั้น ห้ามใช้ข้อมูลผู้ป่วยจริง เลขใบอนุญาตจริง เลขบัญชีจริง รูปเอกสารจริง หรือข้อมูลส่วนตัวจริงระหว่างทดสอบ

## 1. ข้อมูลที่เจ้าของระบบต้องกรอกก่อนส่งให้ทีม

ให้กรอกข้อมูลเหล่านี้ในข้อความส่งงานหรือเอกสารภายในทีม ห้าม commit ค่า secret ลง repo

```text
Testing URL:
Environment: staging / production dry-run
วันที่ deploy:
Commit ที่ deploy:
ผู้ประสานงาน:
ช่องทางแจ้งบั๊ก:
สถานะ LINE LIFF: พร้อม / ยังไม่พร้อม
สถานะ payment provider: พร้อม / stub
สถานะ storage upload: พร้อม / metadata/URL เท่านั้น
สถานะ Zoom: พร้อม / ยังไม่เชื่อมต่อ
```

ตัวอย่าง URL ที่ทีมจะใช้:

- หน้า health check: `https://YOUR-DOMAIN/api/health`
- หน้าเข้าสู่ระบบ: `https://YOUR-DOMAIN/auth/line`
- หน้าเริ่มแบบประเมิน: `https://YOUR-DOMAIN/consult/assessment`

## 2. เงื่อนไขสำคัญก่อนเริ่มทดสอบ

ต้องผ่านเงื่อนไขเหล่านี้ก่อนให้ทีมตรวจสอบ:

1. Plesk app start ได้
2. SSL ใช้งานได้ URL ต้องเป็น `https://`
3. `/api/health` ตอบ `ok`
4. `ENABLE_DEV_AUTH_BYPASS=false` บน hosted environment
5. `NEXT_PUBLIC_APP_URL` ตรงกับ URL จริงบน Plesk
6. `LINE_LOGIN_CALLBACK_URL` ตรงกับ `https://YOUR-DOMAIN/api/auth/line/callback`
7. ใช้ database ทดสอบหรือ staging เท่านั้น ถ้ายังไม่ launch จริง
8. ห้าม seed หรือกรอกข้อมูลจริงที่เป็น sensitive

ผลลัพธ์ health check ที่ถูกต้อง:

```json
{"status":"ok","service":"clinical-ethereality"}
```

## 3. เรื่อง login สำหรับทีมที่อยู่คนละที่

บน Plesk/hosted URL ไม่ควรใช้ปุ่ม dev bypass แบบ local

ถ้า LINE LIFF พร้อม:

- ให้ทีมทดสอบเข้า `https://YOUR-DOMAIN/auth/line`
- ใช้ LINE account ทดสอบที่เจ้าของระบบอนุญาตไว้
- เจ้าของระบบต้องเตรียม test users/test roles ให้เรียบร้อยก่อนส่งให้ทีม

ถ้า LINE LIFF ยังไม่พร้อม:

- ทีมจะทดสอบได้เฉพาะหน้า public/smoke เช่น `/api/health`, `/auth/line` ว่าโหลดได้
- ยังไม่ควรให้ทีมทดสอบ customer/doctor/admin flow บน hosted URL
- ให้กลับไปทดสอบ role flows บน localhost เท่านั้น หรือรอ staging LINE LIFF พร้อม

ห้ามเปิด `ENABLE_DEV_AUTH_BYPASS=true` บน URL สาธารณะเพื่อให้ทีม remote เข้าใช้งาน

## 4. รูปแบบบัญชีทดสอบที่ควรเตรียม

เจ้าของระบบควรเตรียมบัญชีทดสอบอย่างน้อย:

- Customer test account
- Doctor test account
- Admin test account
- Pharmacist test account ถ้ายังต้องตรวจ fulfillment queue

ทุกบัญชีควรใช้ข้อมูลสมมติ เช่น:

- ชื่อทดสอบ
- เบอร์ทดสอบ
- อีเมลทดสอบ
- ที่อยู่ทดสอบ
- รูปภาพทดสอบ
- เอกสารทดสอบที่ไม่มีข้อมูลจริง

## 5. Smoke Test หลังเปิด URL

ให้ทีมตรวจตามลำดับ:

1. เปิด `https://YOUR-DOMAIN/api/health`
2. ต้องเห็น `{"status":"ok","service":"clinical-ethereality"}`
3. เปิด `https://YOUR-DOMAIN/auth/line`
4. หน้าโหลดได้ ไม่มี runtime error
5. URL เป็น `https://`
6. เปิดบนมือถือหรือ mobile viewport แล้ว layout ไม่พัง
7. ลองเข้า `/admin`, `/doctor`, `/pharmacist` โดยยังไม่ login
8. ระบบต้องไม่แสดงข้อมูลภายในก่อนยืนยันตัวตน

ถ้า smoke test ไม่ผ่าน ให้หยุดทดสอบ flow อื่นและแจ้งทีม dev ก่อน

## 6. Customer Flow ที่ต้องทดสอบ

### 6.1 แบบประเมินก่อนพบแพทย์

เริ่มที่:

- `https://YOUR-DOMAIN/consult/assessment`

ตรวจ:

1. หน้าเริ่มแบบประเมินโหลดได้
2. ทำแบบประเมินอาการได้
3. ทำหน้าระยะเวลาได้
4. ส่งแบบประเมินสำเร็จ
5. ระบบแนะนำแพทย์ตามหัวข้อที่ประเมิน
6. ยังมีทางเลือกแพทย์เองได้
7. ถ้าทำซ้ำภายใน 7 วัน ระบบควร reuse assessment เดิม

### 6.2 เลือกแพทย์และจองเวลา

หน้า:

- `https://YOUR-DOMAIN/consult`
- `https://YOUR-DOMAIN/consult/booking/somchai`

ตรวจ:

1. รายชื่อแพทย์โหลดได้
2. เห็นแพทย์ที่แนะนำจาก assessment ถ้ามี
3. เลือกวันเวลาได้
4. กดยืนยันการจองได้
5. slot ที่ถูกจองแล้วไม่ควรเลือกซ้ำได้
6. หลังจองแล้วไปหน้ารายละเอียดนัดหมายหรือหน้าชำระเงิน

### 6.3 รายละเอียดนัดหมายและชำระเงิน

หน้า:

- `/consult/appointments/[consultationId]`
- `/consult/payment`

ตรวจ:

1. เห็นชื่อแพทย์ วัน เวลา และค่าปรึกษา
2. เห็นสถานะ เช่น รอชำระเงิน ชำระแล้ว หรือหมดอายุ
3. ปุ่มต่อไปต้องตรงกับสถานะ
4. QR PromptPay แสดงเมื่อ config พร้อม
5. เลข PromptPay ต้องถูก mask ไม่แสดงเต็ม
6. ถ้า payment provider ยังเป็น stub ต้องมีข้อความที่ทีมเข้าใจได้

## 7. Doctor Flow ที่ต้องทดสอบ

เข้าเป็น doctor แล้วตรวจ:

- `/doctor/consultations`
- `/doctor/patients`

ตรวจ:

1. เห็น consult ที่เกี่ยวข้องกับแพทย์เท่านั้น
2. เห็นสรุปแบบประเมินก่อน consult
3. เห็นสถานะ payment/readiness
4. เห็นข้อความ chat ล่าสุด
5. ส่งข้อความหรือดู chat ได้ตามสิทธิ์
6. ออกใบสั่งยาได้ใน consultation ที่พร้อม
7. ไม่เห็นข้อมูลคนไข้ที่ไม่เกี่ยวข้อง

## 8. Store และ Prescription Order ที่ต้องทดสอบ

หน้า:

- `/store`
- `/store/[slug]`
- `/store/cart`
- `/store/checkout`
- `/store/orders`
- `/store/orders/[orderId]`
- `/consult/prescriptions`

ตรวจ:

1. สินค้าโหลดได้
2. สินค้าทั่วไปเพิ่มลงตะกร้าได้
3. checkout สินค้าทั่วไปได้
4. สินค้าที่ต้องใช้ใบสั่งยาถูกกันไม่ให้ซื้อแบบ cart ปกติ
5. ใบสั่งยาจากแพทย์ใช้ซื้อสินค้าที่ต้องใช้ใบสั่งยาได้
6. external prescription attachment บันทึก metadata/URL ได้ถ้า flow เปิดใช้งาน
7. ระบบไม่เก็บ file bytes ใน MySQL
8. customer เห็น order tracking ของตัวเองเท่านั้น

## 9. Admin Flow ที่ต้องทดสอบ

เข้าเป็น admin แล้วตรวจ:

- `/admin`
- `/admin/users`
- `/admin/schedules`
- `/admin/payments`
- `/admin/orders`
- `/admin/products`
- `/admin/inventory`
- `/admin/moderation`
- `/admin/notifications`
- `/admin/audit`
- `/admin/compliance`

ตรวจ:

1. dashboard โหลดได้
2. จัดการ user/staff ได้ตามสิทธิ์
3. จัดการ schedule ได้
4. ตรวจ payment ได้เมื่ออยู่ในสถานะที่เหมาะสม
5. จัดการ order status ได้
6. เพิ่ม/แก้สินค้าได้
7. จัดการ stock ได้
8. moderation queue โหลดได้
9. ส่ง notification ได้
10. audit log มี record หลัง action สำคัญ
11. integration readiness แสดง configured/missing โดยไม่โชว์ secret

## 10. Pharmacist Flow ที่ต้องทดสอบ

เข้าเป็น pharmacist แล้วตรวจ:

- `/pharmacist/prescriptions`
- `/pharmacist/orders`

ตรวจ:

1. เห็น prescription/order queue ที่เกี่ยวข้อง
2. เห็นข้อมูลที่จำเป็นต่อการเตรียมสินค้า
3. เห็น indicator ถ้ามี external prescription attachment
4. เปลี่ยนสถานะจัดเตรียม/จัดส่งได้ตามสิทธิ์
5. ไม่มี document-review gate เพิ่มหลังลูกค้าแนบใบสั่งยา ตาม requirement ล่าสุด

## 11. Profile, Notification, Community

หน้า:

- `/profile`
- `/profile/settings`
- `/profile/rewards`
- `/profile/saved-articles`
- `/profile/shipping-addresses`
- `/notifications`
- `/community`
- `/community/vitamin-c-tips`
- `/community/create`
- `/community/search`

ตรวจ:

1. profile โหลดได้
2. logout ใช้งานได้
3. rewards แสดงข้อมูลได้
4. notification แสดงรายการได้
5. community โหลดได้โดยไม่ error
6. community content/policy จริงยัง defer หลัง MVP ถ้าลูกค้ายังไม่ขอเปิด

## 12. ข้อจำกัดที่ต้องแจ้งทีมก่อนทดสอบ

- ถ้า LINE LIFF ยังไม่พร้อม ทีม remote จะทดสอบ role flows บน Plesk ไม่ครบ
- Zoom SDK จริงยังไม่ได้เชื่อมต่อจนกว่า owner ส่ง credential
- EasySlip/SlipOK จริงยังไม่ได้เชื่อมต่อจนกว่า owner ส่ง API/webhook
- Cloudinary/S3 upload จริงยังไม่ได้เชื่อมต่อจนกว่าเลือก provider และตั้ง credential
- External prescription upload ปัจจุบันเป็น UX/metadata foundation หากยังไม่เชื่อม storage จริง
- Firebase/realtime provider ยังไม่ได้เลือก in-app chat ตอนนี้ persist ผ่าน Prisma/MySQL
- FDA number สินค้ายัง pending

## 13. ข้อมูลที่ห้ามใส่ระหว่างทดสอบ

ห้ามใส่:

- ข้อมูลผู้ป่วยจริง
- เลขบัตรประชาชนจริง
- เลขใบประกอบวิชาชีพจริง
- รูปใบอนุญาตจริง
- เลขบัญชีเต็ม
- PromptPay จริงใน screenshot สาธารณะ
- API key, token, secret, database URL
- รูปสลิปเงินจริง
- ใบสั่งยาจริง

ใช้ข้อมูลสมมติหรือไฟล์ dummy เท่านั้น

## 14. Template รายงานบั๊ก

```text
ผู้ทดสอบ:
วันที่:
Environment: Plesk staging / production dry-run
URL:
Role: customer / doctor / pharmacist / admin / guest
อุปกรณ์และ browser:
ขั้นตอนที่ทำ:
ผลที่คาดหวัง:
ผลที่เกิดขึ้นจริง:
ผ่าน/ไม่ผ่าน:
ระดับบั๊ก: P0 / P1 / P2 / P3
Screenshot หรือ video:
หมายเหตุ:
```

## 15. ระดับความสำคัญของบั๊ก

- P0: เข้าไม่ได้ทั้งระบบ, login ไม่ได้ทุก role, ข้อมูล sensitive รั่ว, action สำคัญทำข้อมูลผิด
- P1: flow หลักเสีย เช่น booking ไม่ได้, payment verify ไม่ได้, doctor ไม่เห็น assessment, order status ไม่เปลี่ยน
- P2: ข้อความผิด, layout ทับกัน, ปุ่มไม่ชัด, empty state งง
- P3: polish เล็ก ๆ เช่น spacing, wording, icon, alignment

## 16. Flow ที่ควรผ่านก่อนส่งให้ลูกค้าตรวจ

1. Smoke test ผ่าน
2. Customer ทำ assessment จนครบ
3. Customer เลือกแพทย์และจองเวลาได้
4. Customer ไปชำระเงิน consult ได้
5. Doctor เห็น assessment ก่อน consult
6. Doctor ใช้ chat และออกใบสั่งยาได้
7. Customer เห็นใบสั่งยาและสั่งซื้อสินค้า/ยาได้
8. Admin ตรวจ payment/order/inventory/audit ได้
9. Pharmacist/Admin ตรวจ fulfillment queue ได้
10. ไม่มีข้อมูล sensitive โผล่ผิดที่
