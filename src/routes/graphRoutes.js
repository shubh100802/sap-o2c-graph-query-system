const express = require("express");
const {
  fetchGraph,
  fetchNodeDetails,
  expandNode,
} = require("../controllers/graphController");

const router = express.Router();

router.get("/", fetchGraph);
router.get("/node/:type/:id", fetchNodeDetails);
router.get("/expand/:type/:id", expandNode);

module.exports = router;
