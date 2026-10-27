'use client';

// Not used any more (Compose shows AttachmentForm in the page). Kept as a popup wrapper of the same form.

import Modal from './Modal';
import AttachmentForm from './AttachmentForm';
import type { AttachmentSpec, MailCustomer, MailSupplier } from '../Utils/MailTypes';

interface AttachmentModalProps {
  open: boolean;
  customers: MailCustomer[] | null;
  suppliers: MailSupplier[] | null;
  onClose: () => void;
  onAdd: (spec: AttachmentSpec) => void;
}

export default function AttachmentModal({ open, customers, suppliers, onClose, onAdd }: AttachmentModalProps) {
  return (
    <Modal open={open} title="Add Attachment" onClose={onClose}>
      <AttachmentForm customers={customers} suppliers={suppliers} onAdd={onAdd} />
    </Modal>
  );
}
