const schemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS business_partners (
    business_partner VARCHAR(40) PRIMARY KEY,
    customer VARCHAR(40),
    business_partner_name VARCHAR(255),
    business_partner_full_name VARCHAR(255),
    business_partner_category VARCHAR(10),
    created_by_user VARCHAR(60),
    creation_date DATETIME NULL,
    last_change_date DATETIME NULL,
    business_partner_is_blocked TINYINT(1) NULL,
    raw_data JSON NULL,
    INDEX idx_bp_customer (customer)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS business_partner_addresses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    business_partner VARCHAR(40) NOT NULL,
    address_id VARCHAR(40),
    city_name VARCHAR(120),
    country VARCHAR(8),
    postal_code VARCHAR(20),
    region VARCHAR(20),
    street_name VARCHAR(255),
    validity_start_date DATETIME NULL,
    validity_end_date DATETIME NULL,
    raw_data JSON NULL,
    INDEX idx_bpa_bp (business_partner),
    CONSTRAINT fk_bpa_bp
      FOREIGN KEY (business_partner)
      REFERENCES business_partners (business_partner)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS products (
    product VARCHAR(40) PRIMARY KEY,
    product_type VARCHAR(20),
    product_group VARCHAR(40),
    base_unit VARCHAR(20),
    division VARCHAR(20),
    gross_weight DECIMAL(18,4) NULL,
    net_weight DECIMAL(18,4) NULL,
    weight_unit VARCHAR(10),
    is_marked_for_deletion TINYINT(1) NULL,
    creation_date DATETIME NULL,
    last_change_date DATETIME NULL,
    raw_data JSON NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS product_descriptions (
    product VARCHAR(40) NOT NULL,
    language VARCHAR(10) NOT NULL,
    product_description VARCHAR(255),
    raw_data JSON NULL,
    PRIMARY KEY (product, language),
    CONSTRAINT fk_pd_product
      FOREIGN KEY (product)
      REFERENCES products (product)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS sales_order_headers (
    sales_order VARCHAR(40) PRIMARY KEY,
    sales_order_type VARCHAR(20),
    sales_organization VARCHAR(20),
    distribution_channel VARCHAR(20),
    organization_division VARCHAR(20),
    sold_to_party VARCHAR(40),
    creation_date DATETIME NULL,
    created_by_user VARCHAR(60),
    total_net_amount DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    requested_delivery_date DATETIME NULL,
    overall_delivery_status VARCHAR(10),
    raw_data JSON NULL,
    INDEX idx_soh_sold_to_party (sold_to_party),
    CONSTRAINT fk_soh_bp
      FOREIGN KEY (sold_to_party)
      REFERENCES business_partners (business_partner)
      ON DELETE SET NULL
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS sales_order_items (
    sales_order VARCHAR(40) NOT NULL,
    sales_order_item VARCHAR(20) NOT NULL,
    material VARCHAR(40),
    requested_quantity DECIMAL(18,3) NULL,
    requested_quantity_unit VARCHAR(10),
    net_amount DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    production_plant VARCHAR(20),
    storage_location VARCHAR(20),
    raw_data JSON NULL,
    PRIMARY KEY (sales_order, sales_order_item),
    INDEX idx_soi_material (material),
    CONSTRAINT fk_soi_soh
      FOREIGN KEY (sales_order)
      REFERENCES sales_order_headers (sales_order)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_soi_product
      FOREIGN KEY (material)
      REFERENCES products (product)
      ON DELETE SET NULL
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
    delivery_document VARCHAR(40) PRIMARY KEY,
    creation_date DATETIME NULL,
    shipping_point VARCHAR(20),
    overall_goods_movement_status VARCHAR(10),
    overall_picking_status VARCHAR(10),
    raw_data JSON NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS outbound_delivery_items (
    delivery_document VARCHAR(40) NOT NULL,
    delivery_document_item VARCHAR(20) NOT NULL,
    reference_sd_document VARCHAR(40),
    reference_sd_document_item VARCHAR(20),
    actual_delivery_quantity DECIMAL(18,3) NULL,
    delivery_quantity_unit VARCHAR(10),
    plant VARCHAR(20),
    storage_location VARCHAR(20),
    raw_data JSON NULL,
    PRIMARY KEY (delivery_document, delivery_document_item),
    INDEX idx_odi_ref_so (reference_sd_document, reference_sd_document_item),
    CONSTRAINT fk_odi_odh
      FOREIGN KEY (delivery_document)
      REFERENCES outbound_delivery_headers (delivery_document)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS billing_document_headers (
    billing_document VARCHAR(40) PRIMARY KEY,
    billing_document_type VARCHAR(10),
    creation_date DATETIME NULL,
    billing_document_date DATETIME NULL,
    billing_document_is_cancelled TINYINT(1) NULL,
    total_net_amount DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    company_code VARCHAR(20),
    fiscal_year VARCHAR(10),
    accounting_document VARCHAR(40),
    sold_to_party VARCHAR(40),
    raw_data JSON NULL,
    INDEX idx_bdh_acc (company_code, fiscal_year, accounting_document),
    INDEX idx_bdh_sold_to (sold_to_party),
    CONSTRAINT fk_bdh_bp
      FOREIGN KEY (sold_to_party)
      REFERENCES business_partners (business_partner)
      ON DELETE SET NULL
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS billing_document_items (
    billing_document VARCHAR(40) NOT NULL,
    billing_document_item VARCHAR(20) NOT NULL,
    material VARCHAR(40),
    billing_quantity DECIMAL(18,3) NULL,
    billing_quantity_unit VARCHAR(10),
    net_amount DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    reference_sd_document VARCHAR(40),
    reference_sd_document_item VARCHAR(20),
    raw_data JSON NULL,
    PRIMARY KEY (billing_document, billing_document_item),
    INDEX idx_bdi_ref_delivery (reference_sd_document, reference_sd_document_item),
    CONSTRAINT fk_bdi_bdh
      FOREIGN KEY (billing_document)
      REFERENCES billing_document_headers (billing_document)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT fk_bdi_product
      FOREIGN KEY (material)
      REFERENCES products (product)
      ON DELETE SET NULL
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS journal_entry_items_accounts_receivable (
    company_code VARCHAR(20) NOT NULL,
    fiscal_year VARCHAR(10) NOT NULL,
    accounting_document VARCHAR(40) NOT NULL,
    accounting_document_item VARCHAR(20) NOT NULL,
    reference_document VARCHAR(40),
    customer VARCHAR(40),
    posting_date DATETIME NULL,
    document_date DATETIME NULL,
    amount_in_transaction_currency DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    amount_in_company_code_currency DECIMAL(18,2) NULL,
    company_code_currency VARCHAR(10),
    clearing_date DATETIME NULL,
    clearing_accounting_document VARCHAR(40),
    clearing_doc_fiscal_year VARCHAR(10),
    financial_account_type VARCHAR(10),
    raw_data JSON NULL,
    PRIMARY KEY (company_code, fiscal_year, accounting_document, accounting_document_item),
    INDEX idx_jei_reference (reference_document),
    INDEX idx_jei_customer (customer),
    CONSTRAINT fk_jei_bp
      FOREIGN KEY (customer)
      REFERENCES business_partners (business_partner)
      ON DELETE SET NULL
      ON UPDATE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS payments_accounts_receivable (
    company_code VARCHAR(20) NOT NULL,
    fiscal_year VARCHAR(10) NOT NULL,
    accounting_document VARCHAR(40) NOT NULL,
    accounting_document_item VARCHAR(20) NOT NULL,
    customer VARCHAR(40),
    posting_date DATETIME NULL,
    document_date DATETIME NULL,
    amount_in_transaction_currency DECIMAL(18,2) NULL,
    transaction_currency VARCHAR(10),
    amount_in_company_code_currency DECIMAL(18,2) NULL,
    company_code_currency VARCHAR(10),
    clearing_date DATETIME NULL,
    clearing_accounting_document VARCHAR(40),
    clearing_doc_fiscal_year VARCHAR(10),
    financial_account_type VARCHAR(10),
    invoice_reference VARCHAR(40),
    sales_document VARCHAR(40),
    sales_document_item VARCHAR(20),
    raw_data JSON NULL,
    PRIMARY KEY (company_code, fiscal_year, accounting_document, accounting_document_item),
    INDEX idx_par_customer (customer),
    CONSTRAINT fk_par_journal
      FOREIGN KEY (company_code, fiscal_year, accounting_document, accounting_document_item)
      REFERENCES journal_entry_items_accounts_receivable (company_code, fiscal_year, accounting_document, accounting_document_item)
      ON DELETE CASCADE
      ON UPDATE CASCADE
  )
  `,
];

module.exports = { schemaStatements };
