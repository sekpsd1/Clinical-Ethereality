# Consult Assessment Requirement

ลูกค้าต้องการให้ผู้ใช้ทำแบบประเมินก่อนเข้าสู่หน้าเลือกหมอ เมื่อเข้า app หรือ consult flow แล้วควรเจอแบบประเมินเป็นขั้นแรกก่อน doctor list

ไฟล์นี้ใช้เก็บ requirement สำหรับแบบประเมิน ยังไม่ใช่ implementation และยังไม่ควรสร้าง screen ใหม่จนกว่า owner จะได้รับ Stitch HTML export zip สำหรับ assessment screen

## Requirement ที่ได้รับแล้ว

- แบบประเมินออกแบบใน Stitch แล้วทั้งหมด 4 หน้า
- ประเภทคำตอบและ interaction ให้ทำตามที่ออกแบบใน Stitch
- หลังทำแบบประเมินเสร็จ ระบบต้องแนะนำให้ตรงกับหัวข้อที่ลูกค้าทำแบบประเมิน
- หลังทำแบบประเมินเสร็จ ยังต้องมีทางเลือกให้ลูกค้าเลือกหมอเองได้ด้วย
- ถ้าผู้ใช้เคยทำแบบประเมินแล้ว ให้เก็บข้อมูลไว้ 7 วัน และไม่ต้องทำประเมินใหม่ภายในช่วง 7 วัน
- แพทย์ต้องเห็นคำตอบแบบประเมินก่อน consult
- แบบประเมินยังไม่มีช่องแนบรูปภาพหรือไฟล์
- Owner ส่ง Stitch HTML export zip หน้าเริ่มต้นแล้ว และหน้า 1 ถูกนำไป implement เป็น `/consult/assessment` แล้ว
- Owner ส่ง Stitch HTML export zip หน้าอาการเบื้องต้นแล้ว และหน้า 2 ถูกนำไป implement เป็น `/consult/assessment/symptoms` แล้ว
- ยังรอ Stitch HTML export zip สำหรับหน้าถัดไปของแบบประเมินก่อนเชื่อม flow เต็ม

## Flow ที่ตกลงล่าสุด

1. ลูกค้าเข้า app หรือ consult flow
2. ระบบตรวจว่าลูกค้ามีผลแบบประเมินที่ยังไม่หมดอายุภายใน 7 วันหรือไม่
3. ถ้ายังไม่มี หรือหมดอายุแล้ว ให้แสดงแบบประเมินก่อนหน้าเลือกหมอ
4. ลูกค้าทำแบบประเมินตาม 4 หน้าใน Stitch
5. ระบบบันทึกคำตอบและเวลาทำแบบประเมิน
6. ระบบแนะนำหัวข้อ/บริการ/หมอให้ตรงกับคำตอบแบบประเมิน
7. ลูกค้ายังสามารถเลือกหมอเองได้
8. เมื่อเกิด consultation แพทย์ต้องเห็นคำตอบแบบประเมินก่อน consult

## Data และ Permission Notes

- คำตอบแบบประเมินมีแนวโน้มเป็นข้อมูลสุขภาพ จึงต้องอยู่หลัง consent ที่เกี่ยวข้อง
- คำตอบควรผูกกับ customer และ consultation context
- ควรมี timestamp เพื่อเช็กอายุ 7 วัน
- Doctor ต้องเห็นคำตอบก่อน consult
- Admin อาจเห็นได้เฉพาะเพื่อ support/operation ตาม permission ที่จำเป็น
- Pharmacist ยังไม่จำเป็นต้องเห็นคำตอบ เว้นแต่ flow ใบสั่งยาในอนาคตต้องใช้ข้อมูลบางส่วน
- ยังไม่ต้องรองรับรูปภาพหรือ file attachment ในแบบประเมินรอบแรก

## สิ่งที่ต้องรอก่อน implementation

- [x] Stitch HTML export zip สำหรับหน้าเริ่มต้นแบบประเมิน
- [x] Stitch HTML export zip สำหรับหน้าอาการเบื้องต้น
- [ ] Stitch HTML export zip สำหรับหน้าถัดไปของ assessment flow
- [ ] ตรวจชื่อหัวข้อ/บริการ/หมอที่ต้อง recommend จากคำตอบใน Stitch
- [ ] ยืนยันว่า 7 วันนับจากเวลาส่งแบบประเมินล่าสุด
- [ ] ยืนยัน copy หรือ label สุดท้ายจาก Stitch export

## Implementation Notes หลังได้รับ Stitch Export

- เพิ่ม assessment intro เป็น first step ก่อน doctor list ที่ `/consult/assessment`
- เพิ่ม symptom assessment เป็น step 1/3 ที่ `/consult/assessment/symptoms`
- ห้าม redesign หน้าจอจาก Stitch
- ถ้า user มี assessment ภายใน 7 วัน ให้ข้ามไป recommendation/doctor selection ได้
- ถ้า user ไม่มี assessment หรือ assessment หมดอายุ ให้บังคับทำก่อนเลือกหมอ
- แพทย์ต้องเห็น assessment summary ใน doctor consultation context
