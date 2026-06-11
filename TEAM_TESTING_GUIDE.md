# คู่มือทดสอบระบบสำหรับทีมงาน

เอกสารนี้ใช้สำหรับทดสอบระบบ Clinical Ethereality บนเครื่อง local/dev เท่านั้น ห้ามใช้ข้อมูลผู้ป่วยจริง เลขใบอนุญาตจริง เลขบัญชีจริง รูปเอกสารจริง หรือข้อมูลส่วนตัวจริงระหว่างทดสอบ

## 1. ข้อมูลพื้นฐาน

- URL ทดสอบหลัก: `http://localhost:3001`
- หน้าเข้าสู่ระบบ: `http://localhost:3001/auth/line`
- ระบบใช้ local development login bypass เมื่อ `ENABLE_DEV_AUTH_BYPASS=true`
- Production จริงยังต้องใช้ LINE LIFF, Zoom, storage, EasySlip และ secret/env จริงจาก owner-managed setup

## 2. ก่อนเริ่มทดสอบ

ให้ตรวจสิ่งเหล่านี้ก่อนทุกครั้ง:

1. เปิด dev server แล้วที่ `http://localhost:3001`
2. เปิด `http://localhost:3001/api/health`
3. ต้องเห็นผลลัพธ์ประมาณนี้:

```json
{"status":"ok","service":"clinical-ethereality"}
```

ถ้าเข้าเว็บไม่ได้ ให้แจ้งผู้ดูแลระบบ/ทีม dev ให้ restart dev server ก่อนทดสอบ

## 3. วิธีเข้าสู่ระบบตามบทบาท

เข้า `http://localhost:3001/auth/line`

บน local จะมีปุ่ม:

- `Enter as customer`
- `Enter as admin`
- `Enter as doctor`
- `Enter as pharmacist`

หลังทดสอบแต่ละบทบาท ให้ logout ก่อนเปลี่ยน role:

1. ไปที่ `http://localhost:3001/profile`
2. กด `ออกจากระบบ`
3. กลับไปที่ `http://localhost:3001/auth/line`
4. เลือก role ใหม่

### หมายเหตุสำหรับ pharmacist

ให้กด `Enter as pharmacist` เพื่อเข้า `/pharmacist/prescriptions` โดยตรง ถ้าต้องให้ admin ช่วยตรวจ queue เดียวกัน สามารถ login เป็น admin แล้วเข้า `/pharmacist/prescriptions` หรือ `/pharmacist/orders` ได้เช่นกัน เพราะ admin มีสิทธิ์ support queue เหล่านี้

## 4. Checklist ภาพรวมที่ต้องทดสอบ

ให้ทีมทดสอบเช็ก 5 เรื่องหลักในทุกหน้า:

1. หน้าโหลดได้ ไม่มี error
2. ข้อความหลักเป็นภาษาไทย
3. ปุ่มกดได้หรือ disabled อย่างสมเหตุสมผล
4. ข้อมูล sensitive ไม่โผล่ผิดที่ เช่น เลข license เต็ม, เลขบัญชีเต็ม, raw LINE ID ที่ไม่ควรแสดง
5. หลังทำ action แล้วสถานะเปลี่ยน หรือมีข้อความ feedback ชัดเจน

## 5. Customer Flow

### 5.1 แบบประเมินก่อนพบแพทย์

เริ่มที่:

- `http://localhost:3001/consult/assessment`

ขั้นตอนทดสอบ:

1. หน้าเริ่มต้นแบบประเมินแสดงถูกต้อง
2. กดเริ่มทำแบบประเมิน
3. ไปหน้าอาการเบื้องต้น:
   - `/consult/assessment/symptoms`
4. เลือกอาการ 1 ข้อ เช่น ปวดหัว / ไข้ / ไอ / อื่น ๆ
5. ปุ่มถัดไปต้อง active หลังเลือกคำตอบ
6. ไปหน้าระยะเวลา:
   - `/consult/assessment/duration`
7. เลือกระยะเวลา
8. ไปหน้าสำเร็จ:
   - `/consult/assessment/complete`
9. ต้องเห็นข้อความสำเร็จและ CTA ไปดูรายชื่อแพทย์ที่แนะนำ

สิ่งที่ควรเห็น:

- หน้า assessment ไม่มี footer customer
- ข้อความเป็นภาษาไทย
- หลังประเมินเสร็จ ระบบควรพาไป consult พร้อม recommendation
- ถ้าเคยทำแล้วภายใน 7 วัน ระบบควร reuse assessment เดิม

### 5.2 รายชื่อแพทย์และเลือกหมอเอง

เข้า:

- `http://localhost:3001/consult`

ตรวจ:

1. เห็นรายชื่อแพทย์
2. เห็นแพทย์ที่ระบบแนะนำจาก assessment ถ้ามี assessment active
3. ยังสามารถเลือกแพทย์เองได้
4. กดปุ่มจองหรือดูรายละเอียดแพทย์

### 5.3 จองวันเวลา consult

เข้า:

- `http://localhost:3001/consult/booking/somchai`

ตรวจ:

1. เห็นข้อมูลแพทย์
2. เห็นวัน/ช่วงเวลาที่เปิดไว้
3. เลือกช่วงเวลาได้
4. ปุ่มยืนยันการจองกดได้หลังเลือกเวลา
5. หลังยืนยัน ควรถูกพาไปหน้ารายละเอียดนัดหมายหรือ payment
6. slot ที่จองแล้วไม่ควรเลือกซ้ำได้

### 5.4 รายละเอียดนัดหมาย

ตัวอย่าง URL:

- `/consult/appointments/[consultationId]`

ตรวจ:

1. เห็นชื่อแพทย์
2. เห็นวันนัด
3. เห็นเวลานัด
4. เห็นค่าปรึกษา
5. เห็นสถานะ เช่น รอชำระเงิน / ชำระแล้ว
6. CTA ต้องไปถูกทางตามสถานะ เช่น ไปชำระเงิน, ห้องรอ, advice log

### 5.5 ชำระเงิน consult

เข้าได้จาก appointment detail หรือ:

- `http://localhost:3001/consult/payment`

ตรวจ:

1. เห็นยอดชำระ
2. เห็น QR PromptPay ถ้ามี `THAI_QR_PROMPTPAY_ID`
3. เห็นเลข PromptPay แบบ mask ไม่แสดงเต็ม
4. ถ้ายังไม่มี EasySlip จริง ต้องเข้าใจว่าเป็น flow ทดสอบ/stub
5. ข้อความควรเป็นภาษาไทยเท่าที่ทำแล้ว

### 5.6 ห้องรอและห้อง consult

หน้า:

- `http://localhost:3001/consult/waiting-room`
- `http://localhost:3001/consult/live`

ตรวจ:

1. waiting room แสดง checklist และปุ่มเข้าห้อง
2. live consultation ไม่มี footer เพื่อไม่รบกวนการปรึกษา
3. chat แสดงข้อความล่าสุดได้
4. ส่งข้อความใน consult chat ได้ใน flow ที่มี consultation จริง
5. Zoom SDK จริงยังไม่ได้เชื่อมต่อ

### 5.7 ใบสั่งยาและคำแนะนำหลังปรึกษา

หน้า:

- `http://localhost:3001/consult/prescriptions`
- `http://localhost:3001/consult/advice-log`

ตรวจ:

1. เห็นใบสั่งยาที่แพทย์ออก
2. ถ้าใบสั่งยาพร้อมใช้งาน ต้องมีทางไปสั่งซื้อสินค้า/ยาได้
3. เห็นคำแนะนำหลังปรึกษา
4. ไม่ควรเห็นข้อมูลของผู้ป่วยคนอื่น

## 6. Store / Commerce Flow

### 6.1 Marketplace

เข้า:

- `http://localhost:3001/store`

ตรวจ:

1. เห็นรายการสินค้า
2. รูปสินค้าโหลดได้
3. ค้นหา/หมวดหมู่ไม่ทำให้หน้า error
4. กดดูรายละเอียดสินค้าได้

### 6.2 Product Detail

ตัวอย่าง:

- `http://localhost:3001/store/paracetamol-500mg`
- หรือสินค้าอื่นจาก `/store`

ตรวจ:

1. เห็นชื่อสินค้า ราคา รูป รายละเอียด
2. ถ้าสินค้าต้องใช้ใบสั่งยา ระบบต้องไม่ให้ซื้อแบบ cart ปกติ
3. ถ้าไม่ต้องใช้ใบสั่งยา สามารถเพิ่มลง cart ได้
4. ฟิลด์รูปสินค้าใน admin ตอนนี้ยังเป็น URL/metadata foundation ไม่ใช่ upload file จริง

### 6.3 Cart และ Checkout

หน้า:

- `http://localhost:3001/store/cart`
- `http://localhost:3001/store/checkout`

ตรวจ:

1. เพิ่ม/ลดจำนวนสินค้าได้
2. checkout สร้าง order ได้
3. ระบบสร้าง payment/shipment placeholder
4. สินค้าที่ต้องใช้ใบสั่งยาไม่ควร checkout ปกติโดยไม่มี prescription path

### 6.4 Order Tracking

หน้า:

- `http://localhost:3001/store/orders`
- `/store/orders/[orderId]`

ตรวจ:

1. เห็นรายการคำสั่งซื้อของตัวเองเท่านั้น
2. เห็นสถานะชำระเงิน
3. เห็นสถานะจัดส่ง
4. เห็นเลขพัสดุถ้ามี
5. เห็น slip verification panel เมื่อ payment ยัง pending
6. เห็นไฟล์แนบใบสั่งยาภายนอกถ้ามี metadata

## 7. Community / Profile Flow

### 7.1 Community

หน้า:

- `http://localhost:3001/community`
- `http://localhost:3001/community/vitamin-c-tips`
- `http://localhost:3001/community/create`
- `http://localhost:3001/community/search`

ตรวจ:

1. community hub โหลดได้
2. article detail โหลดได้
3. comment/like/report ทำงานตามที่มีข้อมูล seed
4. report content แล้ว admin moderation queue ควรเห็นรายการ
5. Community ยัง defer หลัง MVP สำหรับ content/rules จริง

### 7.2 Profile

หน้า:

- `http://localhost:3001/profile`
- `http://localhost:3001/profile/settings`
- `http://localhost:3001/profile/rewards`
- `http://localhost:3001/profile/saved-articles`
- `http://localhost:3001/profile/shipping-addresses`

ตรวจ:

1. profile แสดงข้อมูลสมาชิก
2. ปุ่มออกจากระบบกดได้
3. consent/privacy section แสดงสถานะ
4. rewards แสดงแต้มและ ledger
5. support screens ไม่ error

## 8. Doctor Flow

Login เป็น doctor แล้วเข้า:

- `http://localhost:3001/doctor/consultations`
- `http://localhost:3001/doctor/patients`

### 8.1 Doctor Consultations

ตรวจ:

1. เห็นคิว consult ที่ assigned ให้แพทย์
2. เห็นสถานะ payment/readiness
3. เห็นคำตอบ pre-consult assessment ก่อน consult
4. เห็นข้อความล่าสุดใน chat ถ้ามี
5. มีทางเปิดแชท/ห้องปรึกษา
6. เขียนใบสั่งยาได้เมื่อสถานะ consult พร้อม
7. หลังออกใบสั่งยา customer ควรเห็นใน `/consult/prescriptions`

### 8.2 Doctor Patients

ตรวจ:

1. เห็น patient logs
2. เห็นจำนวน consult
3. เห็นสถานะใบสั่งยาล่าสุด
4. ไม่แสดง raw LINE ID เต็มใน list ถ้าไม่จำเป็น
5. แพทย์ไม่ควรเห็นข้อมูลคนไข้ที่ไม่เกี่ยวข้อง

## 9. Pharmacist Flow

Login เป็น pharmacist แล้วเข้า:

- `http://localhost:3001/pharmacist/prescriptions`
- `http://localhost:3001/pharmacist/orders`

### 9.1 Prescription Queue

ตรวจ:

1. เห็นรายการใบสั่งยา
2. เห็นชื่อผู้ป่วย/แพทย์
3. เห็น notes หรือ summary
4. ปุ่ม verify/reject ใช้ได้เฉพาะรายการที่ต้องตรวจ
5. หมายเหตุ: ตามคำตอบลูกค้าล่าสุด สินค้าที่ต้องมีใบสั่งยาแนบแล้วซื้อได้โดยไม่ต้องมี document-review gate เพิ่ม แต่ pharmacist queue ยังอยู่สำหรับ workflow ที่เตรียมไว้/operations

### 9.2 Medicine Preparation / Orders

ตรวจ:

1. เห็นคำสั่งซื้อที่ชำระแล้วหรือกำลังจัดเตรียม
2. เห็นข้อมูล payment/shipment
3. เห็น external prescription attachment indicator ถ้ามี
4. กดเริ่มจัดเตรียม / จัดส่ง / ส่งสำเร็จ ได้ตามสถานะ
5. สถานะควรเปลี่ยนและมี feedback

## 10. Admin Flow

Login เป็น admin แล้วเริ่มที่:

- `http://localhost:3001/admin`

### 10.1 Dashboard

ตรวจ:

1. เห็น overview queue
2. เห็น navigation ไป users, schedules, payments, orders, inventory, moderation, audit, compliance
3. หน้าไม่ error เมื่อ database พร้อม

### 10.2 Users / Staff Approval

หน้า:

- `http://localhost:3001/admin/users`

ตรวจ:

1. เห็นคิวผู้ใช้/บุคลากร
2. เห็นลิงก์เชิญ doctor/pharmacist/admin
3. approve/suspend ใช้ได้ตามรายการ
4. ไม่ควรแสดงเลขใบอนุญาต sensitive แบบไม่จำเป็น

### 10.3 Schedules

หน้า:

- `http://localhost:3001/admin/schedules`

ตรวจ:

1. เพิ่มเวลาว่างแพทย์ได้
2. เลือกแพทย์ วัน เวลา ระยะเวลาต่อรอบได้
3. toggle เปิด/ปิด slot ได้
4. booking screen ต้องสะท้อน slot ที่เปิดอยู่

### 10.4 Payments

หน้า:

- `http://localhost:3001/admin/payments`

ตรวจ:

1. เห็นคิวตรวจสลิป
2. เห็นข้อมูล QR, ลิงก์สลิป, provider/source/result
3. verify/reject ได้เมื่อ payment อยู่ในสถานะรอตรวจ
4. หลัง verify order ควรไปสถานะเตรียมสินค้า
5. หลัง reject payment ควรกลับไปให้ลูกค้าชำระใหม่

### 10.5 Orders

หน้า:

- `http://localhost:3001/admin/orders`

ตรวจ:

1. เห็นคำสั่งซื้อ
2. เห็นยอดรวม ลูกค้า shipment/payment
3. เปลี่ยนสถานะ paid -> preparing -> shipped -> delivered ได้ตามปุ่ม
4. เห็นใบสั่งยาที่แนบถ้ามี metadata

### 10.6 Products

หน้า:

- `http://localhost:3001/admin/products`

ตรวจ:

1. สร้างสินค้าได้
2. แก้ชื่อ slug รายละเอียด ราคา สถานะ ได้
3. ตั้ง requires prescription ได้
4. URL รูปภาพตอนนี้เป็น field URL ไม่ใช่ upload จริง
5. ห้ามใส่ข้อมูลจริง sensitive ใน field ทดสอบ

### 10.7 Inventory

หน้า:

- `http://localhost:3001/admin/inventory`

ตรวจ:

1. เห็น stock, reserved, available
2. แก้จำนวน stock ได้
3. แก้ low stock threshold ได้
4. ระบบไม่ควรให้ stock ต่ำกว่า reserved quantity

### 10.8 Moderation

หน้า:

- `http://localhost:3001/admin/moderation`

ตรวจ:

1. เห็น reported/hidden/archived content
2. restore/hide/archive ใช้ได้
3. community report จาก customer ควรมาปรากฏใน queue

### 10.9 Notifications

หน้า:

- `http://localhost:3001/admin/notifications`

ตรวจ:

1. เลือกผู้รับได้
2. เลือกประเภท notification ได้
3. ส่ง notification ได้
4. customer เห็น notification ที่ `/notifications`

### 10.10 Audit

หน้า:

- `http://localhost:3001/admin/audit`

ตรวจ:

1. เห็นประวัติ action สำคัญ
2. payment/order/prescription/inventory/moderation ควรมี audit record หลังทำ action
3. metadata ไม่ควรมี secret จริง

### 10.11 Compliance / Integration Readiness

หน้า:

- `http://localhost:3001/admin/compliance`

ตรวจ:

1. เห็น checklist readiness
2. เห็นสถานะ PromptPay, EasySlip/SlipOK, storage, LINE LIFF, Zoom
3. ไม่แสดง secret value จริง
4. ใช้หน้านี้คุยกับ owner ว่ายังขาด credential อะไร

## 11. สิ่งที่ยังเป็นข้อจำกัดในการทดสอบ

- LINE LIFF production ยังไม่ได้ configure
- Zoom SDK ยังไม่ได้เชื่อมจริง
- EasySlip/SlipOK credentials จริงยัง owner-managed
- Storage upload จริงยังไม่ได้เชื่อม Cloudinary/S3; ตอนนี้เก็บ metadata/URL
- Firebase/realtime provider ยังไม่ได้เลือก; in-app chat ปัจจุบัน persist ผ่าน Prisma/MySQL
- FDA numbers ของ product catalog ยัง pending
- Community policy/content จริง defer หลัง MVP
- Email/password login เป็น later candidate ไม่ใช่ MVP

## 12. Template สำหรับรายงานผลทดสอบ

ให้ทีมงานส่งผลทดสอบด้วยรูปแบบนี้:

```text
ผู้ทดสอบ:
วันที่:
Role ที่ใช้: customer / doctor / pharmacist / admin
URL:
ขั้นตอนที่ทำ:
ผลที่คาดหวัง:
ผลที่เกิดขึ้นจริง:
ผ่าน/ไม่ผ่าน:
Screenshot หรือ video:
หมายเหตุ:
```

## 13. ระดับความสำคัญของ bug

- P0: เข้าไม่ได้ทั้งระบบ, login ไม่ได้ทุก role, ข้อมูล sensitive รั่ว, action สำคัญทำข้อมูลผิด
- P1: flow หลักเสีย เช่น booking ไม่ได้, payment verify ไม่ได้, doctor ไม่เห็น assessment, order status ไม่เปลี่ยน
- P2: ข้อความผิด, layout ทับกัน, ปุ่มไม่ชัด, empty state งง
- P3: polish เล็ก ๆ เช่น spacing, wording, icon, alignment

## 14. Flow หลักที่ควรทดสอบครบก่อนส่งลูกค้า

1. Customer ทำ assessment จนครบ
2. Customer เลือกหมอและจองเวลา
3. Customer ไปหน้าชำระเงิน consult
4. Doctor เห็น assessment ก่อน consult
5. Doctor ส่งข้อความ/ดู chat
6. Doctor ออกใบสั่งยา
7. Customer เห็นใบสั่งยาและสั่งซื้อสินค้า/ยาได้
8. Customer checkout และเห็น order tracking
9. Admin ตรวจ payment/order/inventory/audit
10. Pharmacist/Admin ตรวจ order fulfillment queue
11. Customer เห็น notification และ profile/rewards
