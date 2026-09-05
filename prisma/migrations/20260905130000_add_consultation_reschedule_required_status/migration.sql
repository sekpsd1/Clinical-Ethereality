ALTER TABLE `Consultation`
  MODIFY `status` ENUM(
    'requested',
    'pending_payment',
    'reschedule_required',
    'scheduled',
    'live',
    'completed',
    'cancelled'
  ) NOT NULL DEFAULT 'requested';
