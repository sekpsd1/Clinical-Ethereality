# คู่มือทดสอบระบบสำหรับทีมงาน

เอกสารนี้ใช้สำหรับทดสอบ Clinical Ethereality บนเครื่อง local/dev เท่านั้น ห้ามใช้ข้อมูลผู้ป่วยจริง เลขใบอนุญาตจริง เลขบัญชีจริง รูปเอกสารจริง หรือข้อมูลส่วนตัวจริงระหว่างทดสอบ

## 1. ข้อมูลพื้นฐาน

- URL หลัก: `http://localhost:3001`
- หน้าเข้าสู่ระบบ: `http://localhost:3001/auth/line`
- Health check: `http://localhost:3001/api/health`
- ระบบ local ใช้ dev login bypass เมื่อ `ENABLE_DEV_AUTH_BYPASS=true`
- Production จริงยังต้องใช้ LINE LIFF, Zoom, storage, EasySlip/SlipOK และ secret/env จริงจาก owner-managed setup

ผลลัพธ์ health check ที่ถูกต้อง:

```json
{"status":"ok","service":"clinical-ethereality"}
```

## 2. วิธีเข้าใช้งานตามบทบาท

เข้า `http://localhost:3001/auth/line`

บน local ควรเห็นปุ่ม:

- `Enter as customer`
- `Enter as admin`
- `Enter as doctor`
- `Enter as pharmacist`

หลังทดสอบแต่ละบทบาท ให้ logout ก่อนเปลี่ยนบทบาท:

1. ไปที่ `http://localhost:3001/profile`
2. กด `ออกจากระบบ`
3. กลับไปที่ `http://localhost:3001/auth/line`
4. เลือกบทบาทใหม่

หมายเหตุ: หน้า production จริงไม่ควรเปิด dev bypass และต้องใช้ LINE LIFF login

## 3. กติกาการทดสอบ

ทุกหน้าควรตรวจ 5 เรื่องนี้:

1. หน้าโหลดได้ ไม่มี runtime error
2. ข้อความหลักเป็นภาษาไทยหรือเป็นข้อความที่ตั้งใจให้แสดง
3. ปุ่มกดได้ หรือ disabled อย่างมีเหตุผล
4. ไม่มีข้อมูล sensitive แสดงผิดที่ เช่น license เต็ม เลขบัญชีเต็ม raw LINE ID หรือ secret
5. หลังทำ action แล้วสถานะเปลี่ยน มี feedback หรือพาไปหน้าถูกต้อง

ถ้าเจอบั๊ก ให้แนบ URL, role ที่ใช้, ขั้นตอน, ผลที่คาดหวัง, ผลจริง และ screenshot

## 4. Customer Flow

### 4.1 แบบประเมินก่อนพบแพทย์

เริ่มที่:

- `http://localhost:3001/consult/assessment`

ขั้นตอน:

1. กดเริ่มทำแบบประเมิน
2. ไปหน้าอาการเบื้องต้น `/consult/assessment/symptoms`
3. เลือกอาการ 1 ข้อ เช่น ปวดหัว ไข้ ไอ หรืออื่น ๆ
4. ปุ่มถัดไปต้อง active หลังเลือกคำตอบ
5. ไปหน้าระยะเวลา `/consult/assessment/duration`
6. เลือกระยะเวลาอาการ
7. ส่งแบบประเมินแล้วไปหน้า `/consult/assessment/complete`
8. กดดูรายชื่อแพทย์ที่แนะนำ
9. ระบบควรไป `/consult?recommended=assessment`

สิ่งที่ต้องเห็น:

- หน้า assessment ไม่มี footer customer
- ข้อความเป็นภาษาไทย
- หลังทำเสร็จ ระบบแนะนำแพทย์ตามหัวข้อที่ประเมิน
- ยังสามารถเลือกแพทย์เองได้
- ถ้าเคยทำภายใน 7 วัน ระบบควร reuse assessment เดิม

### 4.2 รายชื่อแพทย์และเลือกแพทย์เอง

เข้า:

- `http://localhost:3001/consult`

ตรวจ:

1. เห็นรายชื่อแพทย์
2. เห็นแพทย์ที่ระบบแนะนำจาก assessment ถ้ามี assessment active
3. ยังเลือกแพทย์เองได้
4. กดไปหน้าจองแพทย์ได้

### 4.3 จองวันเวลาปรึกษา

เข้า:

- `http://localhost:3001/consult/booking/somchai`

ตรวจ:

1. เห็นข้อมูลแพทย์
2. เห็นวันที่และเวลาที่เปิดให้จอง
3. เลือก slot ได้
4. กด `ยืนยันการจอง` ได้หลังเลือก slot
5. หลังจองแล้วควรไปหน้ารายละเอียดนัดหมายหรือหน้าชำระเงิน
6. slot ที่ถูก lock/book แล้วไม่ควรเลือกซ้ำได้

### 4.4 รายละเอียดนัดหมาย

ตัวอย่าง URL:

- `/consult/appointments/[consultationId]`

ตรวจ:

1. เห็นชื่อแพทย์
2. เห็นวันนัดและเวลานัด
3. เห็นค่าปรึกษา
4. เห็นสถานะ เช่น รอชำระเงิน ชำระแล้ว หมดอายุ หรือปิดงาน
5. CTA เปลี่ยนตามสถานะ เช่น ไปชำระเงิน ห้องรอ หรือ advice log
6. ข้อมูลแบบประเมินต้องผูกกับ consult เพื่อให้แพทย์เห็นก่อน consult

### 4.5 ชำระเงิน consult

เข้าได้จาก appointment detail หรือ:

- `http://localhost:3001/consult/payment`

ตรวจ:

1. เห็นยอดชำระ
2. เห็น QR PromptPay ถ้า `THAI_QR_PROMPTPAY_ID` ถูกตั้งค่า
3. เลข PromptPay ต้องถูก mask ไม่แสดงเต็ม
4. ถ้ายังไม่มี EasySlip/SlipOK จริง ให้เข้าใจว่าเป็น flow ทดสอบหรือ stub
5. ไม่ควรแสดง secret หรือข้อมูลบัญชีเต็ม

### 4.6 ห้องรอและห้อง consult

หน้า:

- `http://localhost:3001/consult/waiting-room`
- `http://localhost:3001/consult/live`

ตรวจ:

1. waiting room แสดง checklist และปุ่มเข้าห้อง
2. live consultation ไม่มี footer เพื่อไม่รบกวนการปรึกษา
3. chat แสดงข้อความล่าสุดได้
4. ส่งข้อความใน consult chat ได้ใน consultation ที่มีสิทธิ์
5. Zoom SDK จริงยังไม่ได้เชื่อมต่อ

### 4.7 ใบสั่งยาและคำแนะนำหลังปรึกษา

หน้า:

- `http://localhost:3001/consult/prescriptions`
- `http://localhost:3001/consult/advice-log`

ตรวจ:

1. เห็นใบสั่งยาที่แพทย์ออกให้
2. ถ้าใบสั่งยาพร้อมใช้งาน ต้องมีทางไปสั่งซื้อสินค้า/ยาได้
3. เห็นคำแนะนำหลังปรึกษา
4. ไม่ควรเห็นข้อมูลคนไข้คนอื่น

## 5. Store และ Order Flow

### 5.1 Marketplace

เข้า:

- `http://localhost:3001/store`

ตรวจ:

1. เห็นรายการสินค้า
2. สินค้าแสดงชื่อ ราคา รูป และสถานะได้ถูกต้อง
3. กดไปหน้ารายละเอียดสินค้าได้

### 5.2 รายละเอียดสินค้า

ตัวอย่าง:

- `http://localhost:3001/store/paracetamol-500mg`
- `http://localhost:3001/store/[slug]`

ตรวจ:

1. เห็นชื่อสินค้า รายละเอียด ราคา และรูป
2. สินค้าทั่วไปเพิ่มลงตะกร้าได้
3. สินค้าที่ต้องใช้ใบสั่งยาไม่ควรซื้อแบบ cart ปกติโดยไม่มี prescription path
4. ถ้าเป็น external prescription purchase ต้องมีฟอร์มแนบ metadata/URL ใบสั่งยา
5. ฟอร์มแนบใบสั่งยายังเป็น upload UX stub และยังไม่อัปโหลดไฟล์จริง
6. ระบบเก็บเฉพาะ metadata/URL ไม่เก็บไฟล์ bytes ใน MySQL

หมายเหตุ: ถ้าต้องการทดสอบฟอร์มแนบใบสั่งยา ให้สร้างหรือเปิดสินค้าที่ `requiresPrescription=true` จาก admin ก่อน

### 5.3 Cart และ Checkout

หน้า:

- `http://localhost:3001/store/cart`
- `http://localhost:3001/store/checkout`

ตรวจ:

1. เพิ่มสินค้าเข้าตะกร้าได้
2. เปลี่ยนจำนวนสินค้าได้
3. ลบสินค้าได้
4. checkout สร้าง order/payment/shipment placeholder ได้
5. สินค้าที่ต้องใช้ใบสั่งยาควรถูกกันไม่ให้ checkout แบบทั่วไป

### 5.4 Order Tracking

หน้า:

- `http://localhost:3001/store/orders`
- `/store/orders/[orderId]`
- `http://localhost:3001/store/payment-success`

ตรวจ:

1. เห็นรายการคำสั่งซื้อของ customer ตัวเอง
2. เห็นสถานะ payment, order, shipment
3. เห็น tracking number ถ้ามี
4. ไม่เห็น order ของคนอื่น

## 6. Doctor Flow

Login เป็น doctor แล้วเข้า:

- `http://localhost:3001/doctor/consultations`
- `http://localhost:3001/doctor/patients`

### 6.1 Consultation Queue

ตรวจ:

1. เห็นรายการ consult ที่เกี่ยวข้องกับแพทย์
2. เห็นสถานะ payment/readiness
3. เห็นสรุปแบบประเมินก่อน consult
4. เห็นข้อความ chat ล่าสุด
5. มีทางไป live consult หรือเขียนใบสั่งยาเมื่อสถานะพร้อม
6. ไม่เห็น consult ที่ไม่เกี่ยวข้อง

### 6.2 Patient Log

ตรวจ:

1. เห็นรายการ patient logs
2. เห็นจำนวน consult
3. เห็นสถานะใบสั่งยาล่าสุด
4. ไม่แสดง raw LINE ID แบบเต็มใน list ถ้าไม่จำเป็น
5. แพทย์ไม่ควรเห็นข้อมูลคนไข้ที่ไม่เกี่ยวข้อง

### 6.3 ออกใบสั่งยา

ตรวจจาก consultation ที่พร้อม:

1. เปิดฟอร์มใบสั่งยาได้
2. กรอกยา/คำแนะนำได้
3. ส่งแล้ว customer ควรเห็นใน `/consult/prescriptions`
4. prescription/order/payment/audit linkage ต้องยังอยู่

## 7. Pharmacist Flow

Login เป็น pharmacist แล้วเข้า:

- `http://localhost:3001/pharmacist/prescriptions`
- `http://localhost:3001/pharmacist/orders`

### 7.1 Prescription Queue

ตรวจ:

1. เห็นรายการใบสั่งยา
2. เห็นชื่อผู้ป่วยและแพทย์เท่าที่จำเป็น
3. เห็น notes หรือ summary
4. ไม่เพิ่ม document-review gate หลังลูกค้าแนบใบสั่งยาแล้ว ตาม requirement ล่าสุด
5. queue นี้ยังใช้สำหรับ operations ที่เตรียมไว้

### 7.2 Order Fulfillment

ตรวจ:

1. เห็นคำสั่งซื้อที่เกี่ยวข้องกับการจัดเตรียม
2. เห็น payment/shipment
3. เห็น indicator ถ้ามี external prescription attachment
4. กดเริ่มจัดเตรียม จัดส่ง หรือส่งสำเร็จได้ตามสถานะ
5. สถานะเปลี่ยนและมี feedback ชัดเจน

## 8. Admin Flow

Login เป็น admin แล้วเริ่มที่:

- `http://localhost:3001/admin`

### 8.1 Dashboard

ตรวจ:

1. เห็น overview queue
2. มี navigation ไป users, schedules, payments, orders, products, inventory, moderation, audit, compliance
3. หน้าไม่ error เมื่อ database พร้อม

### 8.2 Users / Staff Approval

หน้า:

- `http://localhost:3001/admin/users`

ตรวจ:

1. เห็นคิวผู้ใช้และบุคลากร
2. เห็นลิงก์เชิญ doctor/pharmacist/admin
3. approve/suspend ได้ตามรายการ
4. ไม่แสดงเลขใบอนุญาต sensitive แบบไม่จำเป็น

### 8.3 Schedules

หน้า:

- `http://localhost:3001/admin/schedules`

ตรวจ:

1. เพิ่มเวลาว่างแพทย์ได้
2. เลือกแพทย์ วัน เวลา และระยะเวลาต่อรอบได้
3. toggle เปิด/ปิด slot ได้
4. booking screen ต้องสะท้อน slot ที่เปิดอยู่

### 8.4 Payments

หน้า:

- `http://localhost:3001/admin/payments`

ตรวจ:

1. เห็นคิวตรวจสลิป
2. เห็น QR payload, slip URL, provider/source/result, transaction reference, amount, receiver
3. verify/reject ได้เมื่อ payment อยู่ในสถานะรอตรวจ
4. หลัง verify สถานะ order ควรขยับไปขั้นเตรียมสินค้า
5. หลัง reject ลูกค้าควรกลับไปชำระใหม่
6. ไม่แสดง API key หรือ secret

### 8.5 Orders

หน้า:

- `http://localhost:3001/admin/orders`

ตรวจ:

1. เห็นคำสั่งซื้อ
2. เห็นยอดรวม ลูกค้า shipment และ payment
3. เปลี่ยนสถานะ paid -> preparing -> shipped -> delivered ได้ตามปุ่ม
4. เห็นใบสั่งยาที่แนบถ้ามี metadata

### 8.6 Products

หน้า:

- `http://localhost:3001/admin/products`

ตรวจ:

1. สร้างสินค้าได้
2. แก้ชื่อ slug รายละเอียด ราคา และสถานะได้
3. ตั้ง `requiresPrescription` ได้
4. ช่องรูปภาพใช้ลิงก์รูปที่อัปโหลดแล้ว เช่น `/images/products/...` หรือ URL จาก storage/CDN
5. ช่องรูปภาพยังไม่ใช่ upload file จริง
6. ห้ามใส่เอกสารส่วนตัวหรือข้อมูล sensitive จริงใน field ทดสอบ

### 8.7 Inventory

หน้า:

- `http://localhost:3001/admin/inventory`

ตรวจ:

1. เห็น stock, reserved, available
2. แก้ stock ได้
3. แก้ low stock threshold ได้
4. ระบบไม่ควรปล่อยให้ stock ต่ำกว่า reserved quantity แบบผิด logic

### 8.8 Moderation

หน้า:

- `http://localhost:3001/admin/moderation`

ตรวจ:

1. เห็น reported/hidden/archived content
2. restore/hide/archive ได้
3. community report จาก customer ควรมาปรากฏใน queue

### 8.9 Notifications

หน้า:

- `http://localhost:3001/admin/notifications`

ตรวจ:

1. เลือกผู้รับได้
2. เลือกประเภท notification ได้
3. ส่ง notification ได้
4. customer เห็น notification ที่ `/notifications`

### 8.10 Audit

หน้า:

- `http://localhost:3001/admin/audit`

ตรวจ:

1. เห็นประวัติ action สำคัญ
2. payment/order/prescription/inventory/moderation ควรมี audit record หลังทำ action
3. metadata ไม่ควรมี secret จริง

### 8.11 Compliance / Integration Readiness

หน้า:

- `http://localhost:3001/admin/compliance`

ตรวจ:

1. เห็น readiness checklist
2. เห็นสถานะ PromptPay, EasySlip/SlipOK, storage, LINE LIFF, Zoom
3. ไม่แสดง secret value จริง
4. ใช้หน้านี้คุยกับ owner ว่ายังขาด credential อะไร

## 9. Community และ Profile

หน้า:

- `http://localhost:3001/community`
- `http://localhost:3001/community/vitamin-c-tips`
- `http://localhost:3001/community/create`
- `http://localhost:3001/community/search`
- `http://localhost:3001/profile`
- `http://localhost:3001/profile/settings`
- `http://localhost:3001/profile/rewards`
- `http://localhost:3001/profile/saved-articles`
- `http://localhost:3001/profile/shipping-addresses`

ตรวจ:

1. หน้าโหลดได้ ไม่มี error
2. profile logout ใช้งานได้
3. rewards แสดงคะแนนและ ledger ได้
4. saved articles และ shipping addresses เป็น support screen ที่เข้าได้
5. community content/policy จริงยัง defer หลัง MVP ยกเว้นลูกค้าขอเปิดก่อน

## 10. ข้อจำกัดที่ยังต้องรอ owner-managed setup

- LINE LIFF production ยังไม่ได้ configure
- Zoom SDK จริงยังไม่ได้เชื่อมต่อ
- EasySlip/SlipOK credentials จริงยัง owner-managed
- Cloudinary/S3 upload จริงยังไม่ได้เชื่อมต่อ ตอนนี้เก็บ metadata/URL
- Firebase หรือ realtime provider ยังไม่ได้เลือก in-app chat ปัจจุบัน persist ผ่าน Prisma/MySQL
- FDA numbers ของ product catalog ยัง pending
- Community policy/content จริง defer หลัง MVP
- Email/password login เป็น later candidate ไม่ใช่ MVP

## 11. ระดับความสำคัญของบั๊ก

- P0: เข้าไม่ได้ทั้งระบบ, login ไม่ได้ทุก role, ข้อมูล sensitive รั่ว, action สำคัญทำข้อมูลผิด
- P1: flow หลักเสีย เช่น booking ไม่ได้, payment verify ไม่ได้, doctor ไม่เห็น assessment, order status ไม่เปลี่ยน
- P2: ข้อความผิด, layout ทับกัน, ปุ่มไม่ชัด, empty state งง
- P3: polish เล็ก ๆ เช่น spacing, wording, icon, alignment

## 12. Template รายงานผลทดสอบ

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

## 13. Flow หลักที่ควรทดสอบครบก่อนส่งลูกค้า

1. Customer ทำ assessment จนครบ
2. Customer เห็นแพทย์ที่แนะนำและยังเลือกหมอเองได้
3. Customer เลือกหมอและจองเวลา
4. Customer ไปหน้าชำระเงิน consult
5. Doctor เห็น assessment ก่อน consult
6. Doctor ส่งข้อความหรือดู chat
7. Doctor ออกใบสั่งยา
8. Customer เห็นใบสั่งยาและสั่งซื้อสินค้า/ยาได้
9. Customer checkout และเห็น order tracking
10. Admin ตรวจ payment/order/inventory/audit
11. Pharmacist/Admin ตรวจ order fulfillment queue
12. Customer เห็น notification และ profile/rewards
