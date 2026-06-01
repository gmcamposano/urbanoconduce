ALTER TABLE invoices ADD COLUMN factura_tipo TEXT NOT NULL DEFAULT 'proforma';
ALTER TABLE invoices ADD COLUMN ncf TEXT;