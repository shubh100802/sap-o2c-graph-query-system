function extractDocId(query) {
  const match = query.match(/\b\d{6,12}\b/);
  return match ? match[0] : null;
}

function highestBillingByProductTemplate() {
  return {
    intent: "highest_billing_products",
    sql: `
      SELECT
        bdi.material AS product_id,
        COALESCE(pd.product_description, bdi.material) AS product_description,
        COUNT(DISTINCT bdi.billing_document) AS billing_document_count
      FROM billing_document_items bdi
      LEFT JOIN product_descriptions pd
        ON pd.product = bdi.material AND pd.language = 'EN'
      WHERE bdi.material IS NOT NULL AND bdi.material <> ''
      GROUP BY bdi.material, pd.product_description
      ORDER BY billing_document_count DESC
      LIMIT 10
    `,
    buildAnswer: (rows) => {
      if (!rows.length) return "No product-to-billing relationships were found.";
      const top = rows[0];
      return `Top product by billing-document coverage is ${top.product_description} (${top.product_id}) with ${top.billing_document_count} billing documents.`;
    },
    getHighlights: (rows) =>
      rows.slice(0, 5).map((row) => `product:${row.product_id}`),
  };
}

function flowByBillingTemplate(docId) {
  return {
    intent: "trace_billing_flow",
    sql: `
      SELECT
        bdh.billing_document,
        bdi.billing_document_item,
        bdi.reference_sd_document AS delivery_document,
        odi.reference_sd_document AS sales_order,
        bdh.accounting_document AS journal_entry,
        jei.accounting_document AS journal_entry_ar,
        jei.company_code,
        jei.fiscal_year,
        par.accounting_document AS payment_document,
        bdh.sold_to_party AS customer_id
      FROM billing_document_headers bdh
      LEFT JOIN billing_document_items bdi
        ON bdi.billing_document = bdh.billing_document
      LEFT JOIN outbound_delivery_items odi
        ON odi.delivery_document = bdi.reference_sd_document
      LEFT JOIN journal_entry_items_accounts_receivable jei
        ON jei.reference_document = bdh.billing_document
      LEFT JOIN payments_accounts_receivable par
        ON par.company_code = jei.company_code
       AND par.fiscal_year = jei.fiscal_year
       AND par.accounting_document = jei.accounting_document
       AND par.accounting_document_item = jei.accounting_document_item
      WHERE bdh.billing_document = '${docId}'
      ORDER BY bdi.billing_document_item
      LIMIT 200
    `,
    buildAnswer: (rows) => {
      if (!rows.length) return `No records found for billing document ${docId}.`;
      const sample = rows[0];
      const salesOrders = [...new Set(rows.map((r) => r.sales_order).filter(Boolean))];
      const deliveries = [...new Set(rows.map((r) => r.delivery_document).filter(Boolean))];
      const journals = [...new Set(rows.map((r) => r.journal_entry_ar || r.journal_entry).filter(Boolean))];
      const payments = [...new Set(rows.map((r) => r.payment_document).filter(Boolean))];
      return `Billing document ${docId} maps to ${salesOrders.length} sales order(s), ${deliveries.length} delivery document(s), ${journals.length} journal entry(s), and ${payments.length} payment record(s). Customer: ${sample.customer_id || "N/A"}.`;
    },
    getHighlights: (rows) => {
      const ids = new Set([`invoice:${docId}`]);
      for (const row of rows) {
        if (row.customer_id) ids.add(`customer:${row.customer_id}`);
        if (row.sales_order) ids.add(`sales_order:${row.sales_order}`);
        if (row.delivery_document) ids.add(`delivery:${row.delivery_document}`);
        if (row.journal_entry_ar && row.company_code && row.fiscal_year) {
          ids.add(`journal:${row.company_code}-${row.fiscal_year}-${row.journal_entry_ar}-1`);
        }
      }
      return Array.from(ids);
    },
  };
}

function incompleteFlowsTemplate() {
  return {
    intent: "incomplete_flows",
    sql: `
      SELECT
        soh.sales_order,
        CASE WHEN odi.delivery_document IS NULL THEN 1 ELSE 0 END AS missing_delivery,
        CASE WHEN bdi.billing_document IS NULL THEN 1 ELSE 0 END AS missing_billing,
        CASE WHEN odi.delivery_document IS NOT NULL AND bdi.billing_document IS NULL THEN 1 ELSE 0 END AS delivered_not_billed
      FROM sales_order_headers soh
      LEFT JOIN outbound_delivery_items odi
        ON odi.reference_sd_document = soh.sales_order
      LEFT JOIN billing_document_items bdi
        ON bdi.reference_sd_document = odi.delivery_document
      WHERE odi.delivery_document IS NULL
         OR bdi.billing_document IS NULL
      GROUP BY soh.sales_order, odi.delivery_document, bdi.billing_document
      ORDER BY delivered_not_billed DESC, missing_delivery DESC, soh.sales_order
      LIMIT 200
    `,
    buildAnswer: (rows) => {
      if (!rows.length) return "No incomplete flows were found in sampled records.";
      const deliveredNotBilled = rows.filter((r) => Number(r.delivered_not_billed) === 1).length;
      const missingDelivery = rows.filter((r) => Number(r.missing_delivery) === 1).length;
      return `Found ${rows.length} sales orders with incomplete flows. Delivered-but-not-billed: ${deliveredNotBilled}. Missing delivery: ${missingDelivery}.`;
    },
    getHighlights: (rows) => rows.slice(0, 15).map((row) => `sales_order:${row.sales_order}`),
  };
}

function journalByBillingTemplate(docId) {
  return {
    intent: "journal_for_billing",
    sql: `
      SELECT
        jei.company_code,
        jei.fiscal_year,
        jei.accounting_document,
        jei.accounting_document_item
      FROM journal_entry_items_accounts_receivable jei
      WHERE jei.reference_document = '${docId}'
      ORDER BY jei.accounting_document, jei.accounting_document_item
      LIMIT 20
    `,
    buildAnswer: (rows) => {
      if (!rows.length) return `No journal entry found for billing document ${docId}.`;
      const first = rows[0];
      return `Journal entry linked to billing document ${docId} is ${first.accounting_document} (company code ${first.company_code}, fiscal year ${first.fiscal_year}).`;
    },
    getHighlights: (rows) =>
      rows.map(
        (r) => `journal:${r.company_code}-${r.fiscal_year}-${r.accounting_document}-${r.accounting_document_item}`
      ),
  };
}

function findTemplate(query) {
  const q = query.toLowerCase();
  const docId = extractDocId(query);

  if (
    q.includes("highest") &&
    q.includes("billing") &&
    (q.includes("product") || q.includes("material"))
  ) {
    return highestBillingByProductTemplate();
  }

  if ((q.includes("trace") || q.includes("full flow")) && q.includes("billing") && docId) {
    return flowByBillingTemplate(docId);
  }

  if (q.includes("incomplete flow") || q.includes("broken flow") || q.includes("delivered but not billed")) {
    return incompleteFlowsTemplate();
  }

  if ((q.includes("journal") || q.includes("accounting document")) && q.includes("billing") && docId) {
    return journalByBillingTemplate(docId);
  }

  return null;
}

module.exports = {
  findTemplate,
};
