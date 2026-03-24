const { getGraph, getNodeDetails, expandAroundNode } = require("../services/graphService");

async function fetchGraph(req, res) {
  try {
    const data = await getGraph(req.query.limit);
    res.status(200).json(data);
  } catch (error) {
    console.error("Graph fetch failed:", error.message);
    res.status(500).json({ error: "Unable to fetch graph data" });
  }
}

module.exports = {
  fetchGraph,
  async fetchNodeDetails(req, res) {
    try {
      const { type, id } = req.params;
      const data = await getNodeDetails(type, id);
      res.status(200).json(data);
    } catch (error) {
      console.error("Node details fetch failed:", error.message);
      res.status(500).json({ error: "Unable to fetch node details" });
    }
  },
  async expandNode(req, res) {
    try {
      const { type, id } = req.params;
      const data = await expandAroundNode(type, id, req.query.limit);
      res.status(200).json(data);
    } catch (error) {
      console.error("Node expand failed:", error.message);
      res.status(500).json({ error: "Unable to expand node" });
    }
  },
};
