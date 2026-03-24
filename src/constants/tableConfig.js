const knownTables = new Set([
  "billing_document_cancellations",
  "billing_document_headers",
  "billing_document_items",
  "business_partners",
  "business_partner_addresses",
  "customer_company_assignments",
  "customer_sales_area_assignments",
  "journal_entry_items_accounts_receivable",
  "outbound_delivery_headers",
  "outbound_delivery_items",
  "payments_accounts_receivable",
  "plants",
  "products",
  "product_descriptions",
  "product_plants",
  "product_storage_locations",
  "sales_order_headers",
  "sales_order_items",
  "sales_order_schedule_lines",
]);

module.exports = { knownTables };
