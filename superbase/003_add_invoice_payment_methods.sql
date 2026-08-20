-- Store the payment method(s) selected when an invoice is created.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT '{}';
