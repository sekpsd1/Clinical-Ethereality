# EasySlip Production Pre-Credential Readiness

เอกสารนี้เป็นขั้นตอนเตรียมใช้งาน EasySlip สำหรับตรวจสอบเงินเข้าเท่านั้น ไม่ใช่ช่องทางโอนหรือคืนเงินออก การคืนเงินของ Store ยังคงเป็นการโอนผ่านธนาคารภายนอกและบันทึกโดย Admin ตาม `REFUND_POLICY.md`.

## Contract ที่รองรับ

- ใช้ EasySlip API v2: `POST https://api.easyslip.com/v2/verify/bank` และ `Authorization: Bearer <API key>`.
- แอปรับหลักฐานได้เพียง QR payload หรือ hosted slip-image URL อย่างใดอย่างหนึ่งต่อครั้ง; ไม่ส่ง slip bytes หรือ Base64 จาก browser ผ่าน API นี้ใน MVP.
- Adapter ส่ง `checkDuplicate: true`, `matchAccount: true`, และ `matchAmount` ที่ตรงยอด Payment ถึงสตางค์. การยืนยันผ่านได้ต่อเมื่อผล v2 มี `rawSlip.transRef`, ยอดและ receiver ที่ตรงกัน, `isAmountMatched: true`, `matchedAccount` ที่ไม่เป็น null, และ `isDuplicate: false`.
- เก็บ reference ที่ normalize แล้วใน unique `Payment.normalizedTransactionReference`; duplicate/replay, mismatch, malformed response, และ concurrent finalization fail closed. Store และ Consultation ใช้ reference rule เดียวกัน.
- Timeout/network, HTTP 401/403/429/5xx, `QUOTA_EXCEEDED`, และ `API_SERVER_ERROR` เป็น provider outage: หลักฐานที่ Store ถูก claim ไว้ใน `pending_review` สำหรับ Admin manual review และไม่มี Payment ที่เป็น `verified`. Consultation ไม่สร้าง/แก้ Payment หรือสถานะนัดจาก provider outage.
- API response ดิบ, QR payload เต็ม, slip bytes, API key, และเลขบัญชีผู้ส่ง/ผู้รับเต็ม ห้ามลง application log, notification, หรือ audit metadata. เก็บเฉพาะข้อมูลขั้นต่ำที่จำเป็นใน Payment record ภายใต้ permission เดิม.

เอกสารอ้างอิงทางการ (ตรวจเมื่อ 2026-08-09):

- [EasySlip API v2 overview](https://document.easyslip.com/en/v2/)
- [POST /verify/bank](https://document.easyslip.com/en/v2/verify/bank/)
- [Verify by payload](https://document.easyslip.com/en/v2/verify/bank/payload)
- [GET /info](https://document.easyslip.com/en/v2/info)

## Owner setup

1. สมัครและยืนยันบัญชี EasySlip Developer, ผ่าน KYC สำหรับ Production, สร้าง Application/Branch และเลือกแพ็กเกจ/quota ที่พอกับปริมาณงาน.
2. ลงทะเบียนบัญชีรับเงินจริงของคลินิกใน EasySlip Application เพื่อให้ `matchAccount: true` มีความหมาย. ค่าชื่อผู้รับที่ใส่ในระบบต้องตรงกับชื่อบัญชีใน slip ตามที่ provider ส่งกลับ.
3. หากเปิด IP allowlist ให้เพิ่ม public egress IP ของ Plesk/Node host ก่อนเปิดใช้งาน. เก็บ API key เฉพาะ Plesk environment variables; ห้ามใส่ใน repository, `.env.example`, browser bundle, screenshot, log, หรือ ticket.
4. ตั้งค่าและตรวจทานโดยเจ้าของสองคนก่อนเปิด `ENABLE_PAYMENTS`:

   - `SLIP_VERIFICATION_PROVIDER=easyslip`
   - `SLIP_VERIFICATION_API_KEY` — EasySlip API key (server only)
   - `SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME` — ชื่อผู้รับแบบ exact match
   - `EASYSLIP_REQUEST_TIMEOUT_MS=10000` — 1,000–30,000 ms
   - `SLIP_VERIFICATION_API_URL` — เว้นว่างเพื่อใช้ v2 production default; ไม่ตั้งเป็น URL private/internal
   - `THAI_QR_PROMPTPAY_ID` — PromptPay receiver ที่อนุมัติแล้ว

5. ไม่ต้องตั้ง `SLIPOK_BRANCH_ID` เมื่อ provider เป็น `easyslip`. Manual Refund ไม่ใช้ API key นี้.

## Plesk, monitoring, และการปฏิบัติการ

- เพิ่มค่า environment ผ่าน Plesk เท่านั้น แล้ว restart Node App เพียงเมื่อมีการ deploy/config change ที่อนุมัติแล้ว. ห้าม commit ค่า secret.
- ก่อนเปิดให้ลูกค้าใช้ ให้เจ้าของตรวจ `/admin/compliance` ว่ามีเฉพาะสถานะ readiness และไม่เผยค่า secret; ตรวจ API key/branch/quota อย่างปลอดภัยจาก EasySlip portal หรือ `GET /v2/info` โดยไม่ log response ที่มี account email/credit.
- ติดตาม quota ของ Application/Branch, HTTP 401/403/429/5xx, timeout, provider-error rate, manual-review queue, duplicate-reference conflict, และ mismatch rate. ไม่มี automatic retry สำหรับ provider error เพราะคำขอ verify ใช้ quota; ให้ customer ใช้ retry/cooldown เดิม หรือให้ Admin manual review.
- 400 validation และ 404 `SLIP_NOT_FOUND` เป็นผลตรวจไม่ผ่าน ไม่ใช่การยืนยัน; Bangkok Bank `SLIP_PENDING` ต้องรอตามคำแนะนำ provider แล้วส่งใหม่. 401/403/429/5xx หรือ network timeout ต้องไม่เปลี่ยน Payment เป็น verified.

## Sandbox / non-monetary UAT

ณ วันที่ตรวจเอกสาร EasySlip API v2 ทางการไม่ประกาศ sandbox base URL, test API key, หรือ official test fixture สำหรับ `/verify/bank`. ห้ามสร้าง fake Production mode และห้ามใช้เงินจริง/สลิปจริงเพื่อทดแทน.

UAT ที่อนุญาตก่อนมี sandbox/fixture จาก EasySlip คือ mocked Local tests และ Local MariaDB integration เท่านั้น. หากเจ้าของได้รับ sandbox หรือ non-monetary fixture เป็นลายลักษณ์อักษรจาก EasySlip ให้บันทึก base URL/ข้อจำกัดนอก git แล้วทำ UAT ตามลำดับนี้: ตรวจ `matchAccount` และ `matchAmount`, verified/rejected/duplicate, outage/429, Store และ Consultation ownership, และยืนยันว่าไม่มี key หรือ raw evidence ใน Console/Network/application logs. ห้ามทำ Production Payment UAT จนกว่าจะมีวิธีทดสอบ non-monetary ที่ provider ยืนยัน.

## Rollback / disable

1. ตั้ง `ENABLE_PAYMENTS=false` หรือถอด `SLIP_VERIFICATION_PROVIDER` ใน Plesk environment แล้ว restart หลัง build/deploy ที่อนุมัติ; อย่าลบ Payment evidence, normalized reference, audit, หรือ manual-review queue.
2. ปิด/rotate API key หรือ deactivate branch ใน EasySlip portal หากสงสัยว่ารั่ว และตรวจ Plesk/IP allowlist.
3. ให้ Admin ทำ manual review เฉพาะหลักฐานที่มีอยู่ตามสิทธิ์เดิม; provider outage ห้ามถูกแปลงเป็น verified/rejected อัตโนมัติ.
4. ตรวจ quota/error monitoring และ Audit Log หลัง disable. ไม่มี migration หรือ database rollback สำหรับงาน readiness นี้.

## Blocker ก่อน Production Payment UAT

ยังไม่มี real browser-to-storage slip upload. UI ปัจจุบันรับ QR payload หรือ URL ที่อยู่ใน owner-managed storage base เท่านั้น; ห้ามอ้างว่ารองรับ browser image upload จนกว่าจะมี Cloudinary/S3 upload flow ที่ตรวจ permission, file type/size, private access, และ URL handoff ครบถ้วน.
