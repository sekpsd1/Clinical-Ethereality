# นโยบายคืนเงิน Store (MVP)

- EasySlip/SlipOK ใช้ตรวจสลิปขาเข้าเท่านั้น และไม่ใช้โอนเงินคืน
- Admin ต้องโอนคืนผ่านธนาคารภายนอกให้สำเร็จก่อน แล้วจึงบันทึก Refund ในระบบ
- รองรับเฉพาะ Store Order และคืนเต็มจำนวนเท่ากับยอดชำระ ไม่มี Partial Refund หรือ Customer self-refund
- คืนได้เฉพาะ Order `paid` หรือ `preparing` ที่ยังไม่มี Shipment สถานะ `shipped` หรือ `delivered`
- Order ที่ `pending_payment`, `payment_review`, `cancelled`, `shipped`, หรือ `delivered` ไม่เข้า workflow นี้; unpaid cancellation ไม่ใช่ Refund
- ระบบเก็บเลขอ้างอิงการโอนคืนแยกจากเลขอ้างอิงสลิปขาเข้า พร้อม normalized unique reference เพื่อป้องกันบันทึกซ้ำ
- เมื่อบันทึกสำเร็จ ระบบเปลี่ยน Payment/Order เป็น `refunded`, ยกเลิก Shipment ที่ยังไม่ส่ง, คืน stock หนึ่งครั้ง และสร้าง compensating RewardPoint ledger; ยอดแต้มอาจติดลบได้เพื่อไม่ขัดขวางการคืนเงินจริง
- ผู้ปฏิบัติงานต้องกรอกเลขอ้างอิง ยอดเต็มจำนวน เหตุผล และยืนยันว่าโอนเงินจริงภายนอกสำเร็จแล้ว ทุกครั้ง
