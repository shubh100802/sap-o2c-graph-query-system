const domainKeywords = [
  "sap",
  "o2c",
  "order",
  "sales order",
  "delivery",
  "invoice",
  "billing",
  "customer",
  "business partner",
  "journal",
  "payment",
  "document",
  "product",
  "material",
  "plant",
  "accounts receivable",
  "fiscal",
  "company code",
  "trace",
  "flow",
];

const blockedKeywords = [
  "weather",
  "movie",
  "recipe",
  "poem",
  "story",
  "cricket",
  "football",
  "stock price",
  "bitcoin",
  "politics",
  "celebrity",
  "joke",
];

function extractDocumentLikeTokens(query) {
  const matches = query.match(/\b\d{6,12}\b/g);
  return matches || [];
}

function isDatasetQuery(query) {
  if (!query || typeof query !== "string") return false;
  const normalized = query.toLowerCase().trim();
  if (!normalized) return false;
  if (blockedKeywords.some((word) => normalized.includes(word))) return false;

  if (domainKeywords.some((word) => normalized.includes(word))) return true;
  return extractDocumentLikeTokens(normalized).length > 0;
}

module.exports = {
  isDatasetQuery,
  extractDocumentLikeTokens,
};
