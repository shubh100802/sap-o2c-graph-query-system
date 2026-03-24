const { isDatasetQuery } = require("../services/guardrailService");
const { generateSqlFromNl } = require("../services/llmService");
const { executeReadOnlyQuery } = require("../services/queryService");
const { findTemplate } = require("../services/templateQueryService");
const { summarizeGenericRows } = require("../services/answerService");

async function runQuery(req, res) {
  try {
    const userQuery = req.body?.query;
    if (!userQuery || typeof userQuery !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    if (!isDatasetQuery(userQuery)) {
      return res.status(400).json({
        error: "This system is designed to answer questions related to the provided dataset only.",
      });
    }

    const template = findTemplate(userQuery);
    let sql = "";
    let intent = template ? template.intent : "llm_generated";

    if (template) {
      sql = template.sql;
    } else {
      try {
        sql = await generateSqlFromNl(userQuery);
      } catch (error) {
        return res.status(400).json({
          error:
            "No template matched this query and LLM is unavailable. Add a GROQ/GEMINI API key for open-ended NL querying.",
          details: error.message,
        });
      }
    }

    const rows = await executeReadOnlyQuery(sql);
    const answer = template ? template.buildAnswer(rows) : summarizeGenericRows(rows);
    const highlightNodeIds = template ? template.getHighlights(rows) : [];

    return res.status(200).json({
      intent,
      answer,
      sql,
      rowCount: rows.length,
      data: rows,
      highlightNodeIds,
    });
  } catch (error) {
    console.error("Query API failed:", error.message);
    return res.status(500).json({
      error: "Failed to process query.",
      details: error.message,
    });
  }
}

module.exports = {
  runQuery,
};
