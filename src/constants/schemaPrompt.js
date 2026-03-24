const schemaPrompt = `
Tables and keys:

business_partners(
  business_partner PK, customer, business_partner_name
)

business_partner_addresses(
  id PK, business_partner FK -> business_partners.business_partner, city_name, country, postal_code
)

products(
  product PK, product_type, product_group, base_unit
)

product_descriptions(
  product FK -> products.product, language, product_description, PK(product, language)
)

sales_order_headers(
  sales_order PK, sold_to_party FK -> business_partners.business_partner, creation_date, total_net_amount
)

sales_order_items(
  PK(sales_order, sales_order_item), sales_order FK -> sales_order_headers.sales_order,
  material FK -> products.product, requested_quantity, net_amount
)

outbound_delivery_headers(
  delivery_document PK, creation_date, shipping_point
)

outbound_delivery_items(
  PK(delivery_document, delivery_document_item),
  delivery_document FK -> outbound_delivery_headers.delivery_document,
  reference_sd_document, reference_sd_document_item, actual_delivery_quantity
)

billing_document_headers(
  billing_document PK, sold_to_party FK -> business_partners.business_partner,
  accounting_document, company_code, fiscal_year, billing_document_date, total_net_amount
)

billing_document_items(
  PK(billing_document, billing_document_item),
  billing_document FK -> billing_document_headers.billing_document,
  reference_sd_document, reference_sd_document_item, material
)

journal_entry_items_accounts_receivable(
  PK(company_code, fiscal_year, accounting_document, accounting_document_item),
  reference_document (links to billing_document_headers.billing_document),
  customer FK -> business_partners.business_partner
)

payments_accounts_receivable(
  PK(company_code, fiscal_year, accounting_document, accounting_document_item),
  FK(company_code, fiscal_year, accounting_document, accounting_document_item)
    -> journal_entry_items_accounts_receivable(...)
)

Join hints:
- customer -> order: business_partners.business_partner = sales_order_headers.sold_to_party
- order -> order item: sales_order_headers.sales_order = sales_order_items.sales_order
- order item -> delivery item: sales_order_items.sales_order = outbound_delivery_items.reference_sd_document
- delivery item -> billing item: outbound_delivery_items.delivery_document = billing_document_items.reference_sd_document
- billing header -> journal: billing_document_headers.billing_document = journal_entry_items_accounts_receivable.reference_document
- journal -> payment: composite key equality on company_code/fiscal_year/accounting_document/accounting_document_item
`;

module.exports = { schemaPrompt };
