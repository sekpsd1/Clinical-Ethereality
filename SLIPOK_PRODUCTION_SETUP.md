# SlipOK Production Setup (Private Payment Slip Upload)

เอกสารนี้เป็น runbook สำหรับเปิดใช้ SlipOK หลังได้รับอนุมัติ Production activation แยกต่างหากเท่านั้น ไม่ใช่คำสั่งให้ deploy หรือทดสอบด้วยเงินจริง/สลิปจริง

## ขอบเขตที่รองรับ

- SlipOK ตรวจ private payment slip ที่ถูกบันทึกแล้วใน `PAYMENT_UPLOAD_DIR` เท่านั้น โดย Node อ่าน bytes จาก `FileAttachment.storageKey` และส่ง multipart field `files` โดยตรง
- ห้ามส่ง public URL, Google Drive URL, signed URL หรือ absolute path ไปที่ SlipOK
- ส่ง `amount` จาก `Payment.amount` และ `log=true` เพื่อให้ SlipOK ตรวจ Branch receiver และ duplicate
- เก็บเฉพาะผล normalized: สถานะ, `transRef`, ยอด, receiver และเวลาโอนเมื่อผลผ่าน; ชื่อ receiver อาจถูก masked จึงใช้ Branch receiver validation ของ SlipOK (`log=true`/error `1014`) เป็น authoritative และห้าม exact-match ชื่อจาก response เอง. ห้ามเก็บ raw provider response, QR payload, account number หรือ file bytes ใน audit/notification/log
- Store ที่ provider ล่มยังคงอยู่ใน queue สำหรับ Admin manual review ตามสิทธิ์เดิม; Consultation เป็น provider-owned เสมอและห้าม Admin manual verify/reject

อ้างอิง contract: [SlipOK Check Slip](https://slipok.com/api-documentation/check-slip/) และ [response/error examples](https://slipok.com/api-documentation/request-response-example/) (ตรวจเมื่อ 2026-08-09)

## ก่อนเปิดใช้

1. รับ Branch ID และ API key ผ่านช่องทางลับ และตรวจ registered receiver account ใน SlipOK/LINE LIFF ให้ถูกต้อง
2. ให้ผู้รับผิดชอบ privacy อนุมัติการส่ง `log=true` ก่อน เพราะ SlipOK จะใช้ข้อมูลเพื่อตรวจ receiver/duplicate ใน dashboard ของ provider
3. ตกลง quota: OK BASIC จำกัด 100 slips/เดือน; หากใช้งานเกินต้องอัปเกรด OK Start ก่อนเปิดรับปริมาณนั้น
4. ตั้ง `PAYMENT_UPLOAD_DIR` เป็น absolute private directory นอก document root/deployment directory และให้ Node app user อ่าน/เขียนเท่าที่จำเป็น
5. เนื่องจากไม่มี Sandbox/Test Fixture ห้ามเปิด feature หรือส่ง request จริงจนกว่าจะมี Controlled Real-slip UAT ที่อนุมัติแยกต่างหาก

## Plesk environment (server only)

ตั้งผ่าน Plesk environment variables เท่านั้น และห้าม commit หรือแสดงค่าใน ticket/log:

- `SLIP_VERIFICATION_PROVIDER=slipok`
- `SLIP_VERIFICATION_API_KEY=<SlipOK API key>`
- `SLIPOK_BRANCH_ID=<SlipOK Branch ID>`
- `SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME` ใช้เฉพาะ EasySlip fallback ที่ยังไม่ active; SlipOK ไม่ใช้ค่านี้
- `SLIPOK_REQUEST_TIMEOUT_MS=10000` (1,000–30,000 ms)
- `SLIP_VERIFICATION_API_URL` เว้นว่างเพื่อใช้ production default `https://api.slipok.com`; override เฉพาะ endpoint ที่ owner อนุมัติ
- `PAYMENT_UPLOAD_DIR=<absolute private directory>`

หลังมีการอนุมัติ config/deploy แล้ว ให้ตรวจ `/admin/compliance` ว่าแสดง readiness โดยไม่เผย secret. ขั้นตอนนี้ไม่ได้อนุมัติการ Deploy/Restart เอง

## Fail-closed และ monitoring

- `1012` duplicate, `1013` amount mismatch, `1014` receiver mismatch: ไม่ยืนยัน Payment
- `1009`/`1010`, HTTP 401/403/429/5xx, auth/package/quota/network/timeout: provider error เท่านั้น ห้ามทำ Payment เป็น `verified`
- ไม่มี automatic retry เพราะ request ใช้ quota; ใช้ retry/cooldown และตรวจ duplicate normalized transaction reference/CAS ตามระบบเดิม
- ติดตาม quota, provider-error rate, mismatch, duplicate, Store manual-review queue และ normalized-reference conflicts โดยไม่ log raw response หรือ evidence

## Controlled Real-slip UAT และ rollback

Production activation ต้องมี owner approval, privacy approval สำหรับ `log=true`, credentials ที่ตั้งผ่าน Plesk, และแผน Controlled Real-slip UAT ที่ได้รับอนุมัติเป็นลายลักษณ์อักษร. ห้ามใช้เงินจริงหรือสลิปจริงก่อนครบทั้งหมด.

หากต้องหยุดใช้ ให้ถอน `SLIP_VERIFICATION_PROVIDER` หรือหมุน/ปิด API key ใน SlipOK/Plesk ตาม change ที่อนุมัติ แล้ว restart/deploy เฉพาะเมื่อได้รับคำสั่ง. ห้ามลบ FileAttachment, Payment, audit, notification หรือ normalized transaction reference ระหว่าง rollback.
