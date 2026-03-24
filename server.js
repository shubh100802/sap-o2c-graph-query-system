require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const graphRoutes = require("./src/routes/graphRoutes");
const queryRoutes = require("./src/routes/queryRoutes");
const { testConnection } = require("./src/config/db");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/vendor/cytoscape",
  express.static(path.join(__dirname, "node_modules", "cytoscape", "dist"))
);

app.get("/health", async (_req, res) => {
  const dbOk = await testConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    database: dbOk ? "connected" : "disconnected",
  });
});

app.use("/api/graph", graphRoutes);
app.use("/api/query", queryRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
