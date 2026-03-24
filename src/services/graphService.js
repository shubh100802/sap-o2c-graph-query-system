const { pool } = require("../config/db");

function dedupeNodes(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    if (!byId.has(node.id)) byId.set(node.id, node);
  }
  return Array.from(byId.values());
}

function dedupeEdges(edges) {
  const byKey = new Map();
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.relationship}`;
    if (!byKey.has(key)) byKey.set(key, edge);
  }
  return Array.from(byKey.values());
}

function mapRowsToGraph(flowRows) {
  const nodes = [];
  const edges = [];

  for (const row of flowRows) {
    if (row.customer_id) {
      nodes.push({
        id: `customer:${row.customer_id}`,
        label: row.customer_name || row.customer_id,
        type: "customer",
      });
    }
    if (row.sales_order) {
      nodes.push({
        id: `sales_order:${row.sales_order}`,
        label: row.sales_order,
        type: "sales_order",
      });
    }
    if (row.delivery_document) {
      nodes.push({
        id: `delivery:${row.delivery_document}`,
        label: row.delivery_document,
        type: "delivery",
      });
    }
    if (row.billing_document) {
      nodes.push({
        id: `invoice:${row.billing_document}`,
        label: row.billing_document,
        type: "invoice",
      });
    }
    if (row.journal_key) {
      nodes.push({
        id: `journal:${row.journal_key}`,
        label: row.journal_document || row.journal_key,
        type: "journal_entry",
      });
    }
    if (row.payment_key) {
      nodes.push({
        id: `payment:${row.payment_key}`,
        label: row.payment_key,
        type: "payment",
      });
    }

    if (row.customer_id && row.sales_order) {
      edges.push({
        source: `customer:${row.customer_id}`,
        target: `sales_order:${row.sales_order}`,
        relationship: "PLACED",
      });
    }
    if (row.sales_order && row.delivery_document) {
      edges.push({
        source: `sales_order:${row.sales_order}`,
        target: `delivery:${row.delivery_document}`,
        relationship: "FULFILLED_BY",
      });
    }
    if (row.delivery_document && row.billing_document) {
      edges.push({
        source: `delivery:${row.delivery_document}`,
        target: `invoice:${row.billing_document}`,
        relationship: "BILLED_AS",
      });
    }
    if (row.billing_document && row.journal_key) {
      edges.push({
        source: `invoice:${row.billing_document}`,
        target: `journal:${row.journal_key}`,
        relationship: "POSTED_TO",
      });
    }
    if (row.journal_key && row.payment_key) {
      edges.push({
        source: `journal:${row.journal_key}`,
        target: `payment:${row.payment_key}`,
        relationship: "SETTLED_BY",
      });
    }
  }

  return {
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

async function getGraph(limit = 300) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Number(limit), 1500) : 300;
  const [flowRows] = await pool.query(
    `
      SELECT
        bp.business_partner AS customer_id,
        COALESCE(NULLIF(bp.business_partner_name, ''), bp.business_partner) AS customer_name,
        soh.sales_order,
        odh.delivery_document,
        bdh.billing_document,
        jei.accounting_document AS journal_document,
        CONCAT(jei.company_code, '-', jei.fiscal_year, '-', jei.accounting_document, '-', jei.accounting_document_item) AS journal_key,
        CONCAT(par.company_code, '-', par.fiscal_year, '-', par.accounting_document, '-', par.accounting_document_item) AS payment_key
      FROM sales_order_headers soh
      LEFT JOIN business_partners bp
        ON bp.business_partner = soh.sold_to_party
      LEFT JOIN outbound_delivery_items odi
        ON odi.reference_sd_document = soh.sales_order
      LEFT JOIN outbound_delivery_headers odh
        ON odh.delivery_document = odi.delivery_document
      LEFT JOIN billing_document_items bdi
        ON bdi.reference_sd_document = odh.delivery_document
      LEFT JOIN billing_document_headers bdh
        ON bdh.billing_document = bdi.billing_document
      LEFT JOIN journal_entry_items_accounts_receivable jei
        ON jei.reference_document = bdh.billing_document
      LEFT JOIN payments_accounts_receivable par
        ON par.company_code = jei.company_code
       AND par.fiscal_year = jei.fiscal_year
       AND par.accounting_document = jei.accounting_document
       AND par.accounting_document_item = jei.accounting_document_item
      LIMIT ?
    `,
    [safeLimit]
  );

  return mapRowsToGraph(flowRows);
}

async function getNodeDetails(type, id) {
  const t = String(type || "").toLowerCase();
  const nodeId = String(id || "");
  const details = { type: t, id: nodeId, metadata: null };

  if (t === "customer") {
    const [rows] = await pool.query("SELECT * FROM business_partners WHERE business_partner = ? LIMIT 1", [nodeId]);
    details.metadata = rows[0] || null;
    return details;
  }
  if (t === "sales_order") {
    const [header] = await pool.query("SELECT * FROM sales_order_headers WHERE sales_order = ? LIMIT 1", [nodeId]);
    const [items] = await pool.query(
      "SELECT * FROM sales_order_items WHERE sales_order = ? ORDER BY sales_order_item LIMIT 50",
      [nodeId]
    );
    details.metadata = { header: header[0] || null, items };
    return details;
  }
  if (t === "delivery") {
    const [header] = await pool.query("SELECT * FROM outbound_delivery_headers WHERE delivery_document = ? LIMIT 1", [nodeId]);
    const [items] = await pool.query(
      "SELECT * FROM outbound_delivery_items WHERE delivery_document = ? ORDER BY delivery_document_item LIMIT 50",
      [nodeId]
    );
    details.metadata = { header: header[0] || null, items };
    return details;
  }
  if (t === "invoice") {
    const [header] = await pool.query("SELECT * FROM billing_document_headers WHERE billing_document = ? LIMIT 1", [nodeId]);
    const [items] = await pool.query(
      "SELECT * FROM billing_document_items WHERE billing_document = ? ORDER BY billing_document_item LIMIT 50",
      [nodeId]
    );
    details.metadata = { header: header[0] || null, items };
    return details;
  }
  if (t === "journal_entry" || t === "journal") {
    const parts = nodeId.split("-");
    if (parts.length < 4) return details;
    const [rows] = await pool.query(
      `
      SELECT *
      FROM journal_entry_items_accounts_receivable
      WHERE company_code = ? AND fiscal_year = ? AND accounting_document = ? AND accounting_document_item = ?
      LIMIT 1
      `,
      [parts[0], parts[1], parts[2], parts[3]]
    );
    details.metadata = rows[0] || null;
    return details;
  }
  if (t === "payment") {
    const parts = nodeId.split("-");
    if (parts.length < 4) return details;
    const [rows] = await pool.query(
      `
      SELECT *
      FROM payments_accounts_receivable
      WHERE company_code = ? AND fiscal_year = ? AND accounting_document = ? AND accounting_document_item = ?
      LIMIT 1
      `,
      [parts[0], parts[1], parts[2], parts[3]]
    );
    details.metadata = rows[0] || null;
    return details;
  }
  if (t === "product") {
    const [rows] = await pool.query("SELECT * FROM products WHERE product = ? LIMIT 1", [nodeId]);
    details.metadata = rows[0] || null;
    return details;
  }

  return details;
}

async function expandAroundNode(type, id, limit = 200) {
  const t = String(type || "").toLowerCase();
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Number(limit), 1000) : 200;
  let filterSql = "";
  let params = [];

  if (t === "customer") {
    filterSql = "WHERE bp.business_partner = ?";
    params = [id];
  } else if (t === "sales_order") {
    filterSql = "WHERE soh.sales_order = ?";
    params = [id];
  } else if (t === "delivery") {
    filterSql = "WHERE odh.delivery_document = ?";
    params = [id];
  } else if (t === "invoice") {
    filterSql = "WHERE bdh.billing_document = ?";
    params = [id];
  } else if (t === "journal" || t === "journal_entry") {
    const parts = String(id).split("-");
    if (parts.length >= 4) {
      filterSql =
        "WHERE jei.company_code = ? AND jei.fiscal_year = ? AND jei.accounting_document = ? AND jei.accounting_document_item = ?";
      params = [parts[0], parts[1], parts[2], parts[3]];
    }
  } else if (t === "payment") {
    const parts = String(id).split("-");
    if (parts.length >= 4) {
      filterSql =
        "WHERE par.company_code = ? AND par.fiscal_year = ? AND par.accounting_document = ? AND par.accounting_document_item = ?";
      params = [parts[0], parts[1], parts[2], parts[3]];
    }
  }

  const [rows] = await pool.query(
    `
      SELECT
        bp.business_partner AS customer_id,
        COALESCE(NULLIF(bp.business_partner_name, ''), bp.business_partner) AS customer_name,
        soh.sales_order,
        odh.delivery_document,
        bdh.billing_document,
        jei.accounting_document AS journal_document,
        CONCAT(jei.company_code, '-', jei.fiscal_year, '-', jei.accounting_document, '-', jei.accounting_document_item) AS journal_key,
        CONCAT(par.company_code, '-', par.fiscal_year, '-', par.accounting_document, '-', par.accounting_document_item) AS payment_key
      FROM sales_order_headers soh
      LEFT JOIN business_partners bp
        ON bp.business_partner = soh.sold_to_party
      LEFT JOIN outbound_delivery_items odi
        ON odi.reference_sd_document = soh.sales_order
      LEFT JOIN outbound_delivery_headers odh
        ON odh.delivery_document = odi.delivery_document
      LEFT JOIN billing_document_items bdi
        ON bdi.reference_sd_document = odh.delivery_document
      LEFT JOIN billing_document_headers bdh
        ON bdh.billing_document = bdi.billing_document
      LEFT JOIN journal_entry_items_accounts_receivable jei
        ON jei.reference_document = bdh.billing_document
      LEFT JOIN payments_accounts_receivable par
        ON par.company_code = jei.company_code
       AND par.fiscal_year = jei.fiscal_year
       AND par.accounting_document = jei.accounting_document
       AND par.accounting_document_item = jei.accounting_document_item
      ${filterSql}
      LIMIT ?
    `,
    [...params, safeLimit]
  );

  return mapRowsToGraph(rows);
}

module.exports = {
  getGraph,
  getNodeDetails,
  expandAroundNode,
};
