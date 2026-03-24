/* global cytoscape */

let cy;
let selectedNode = null;

const chatLogEl = document.getElementById("chatLog");
const queryInputEl = document.getElementById("queryInput");
const sendBtnEl = document.getElementById("sendBtn");
const runExamplesBtnEl = document.getElementById("runExamplesBtn");
const nodeDetailsEl = document.getElementById("nodeDetails");
const selectedNodeTagEl = document.getElementById("selectedNodeTag");
const expandNodeBtnEl = document.getElementById("expandNodeBtn");
const reloadGraphBtnEl = document.getElementById("reloadGraphBtn");
const fitGraphBtnEl = document.getElementById("fitGraphBtn");
const nodeSearchInputEl = document.getElementById("nodeSearchInput");
const searchNodeBtnEl = document.getElementById("searchNodeBtn");
const clearHighlightBtnEl = document.getElementById("clearHighlightBtn");
const graphStatsEl = document.getElementById("graphStats");
const graphLoadingEl = document.getElementById("graphLoading");
const exampleChipEls = document.querySelectorAll(".example-chip");

function setLoading(isLoading) {
  graphLoadingEl.classList.toggle("hidden", !isLoading);
}

function addMessage(role, text, extra = "") {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatLogEl.appendChild(div);
  if (extra) {
    const pre = document.createElement("pre");
    pre.className = `msg ${role}`;
    pre.textContent = extra;
    chatLogEl.appendChild(pre);
  }
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function nodeType(id) {
  return id.includes(":") ? id.split(":")[0] : "";
}

function nodeKey(id) {
  return id.includes(":") ? id.substring(id.indexOf(":") + 1) : id;
}

function toElements(graphData) {
  const nodes = graphData.nodes.map((n) => ({
    data: { id: n.id, label: n.label, type: n.type },
  }));
  const edges = graphData.edges.map((e) => ({
    data: {
      id: `e-${e.source}-${e.target}-${e.relationship}`,
      source: e.source,
      target: e.target,
      relationship: e.relationship,
    },
  }));
  return { nodes, edges };
}

function updateStats() {
  if (!cy) return;
  graphStatsEl.textContent = `Nodes: ${cy.nodes().length} | Edges: ${cy.edges().length}`;
}

function clearHighlights() {
  if (!cy) return;
  cy.elements().removeClass("highlight").removeClass("dim");
}

function formatDetailsBlock(title, objectData) {
  const rows = Object.entries(objectData || {})
    .slice(0, 35)
    .map(
      ([k, v]) => `<div class="detail-row"><strong>${k}</strong>: ${v === null || v === undefined ? "N/A" : String(v)}</div>`
    )
    .join("");
  return `<div class="detail-group"><div class="detail-title">${title}</div>${rows || "<div class='detail-row'>No fields</div>"}</div>`;
}

function renderNodeDetails(data) {
  const metadata = data?.metadata;
  if (!metadata) {
    nodeDetailsEl.innerHTML = "<div class='detail-row'>No metadata found.</div>";
    return;
  }

  if (metadata.header || metadata.items) {
    const headerHtml = formatDetailsBlock("Header", metadata.header || {});
    const firstItem = Array.isArray(metadata.items) ? metadata.items[0] : null;
    const itemsHtml = formatDetailsBlock("First Item (sample)", firstItem || {});
    nodeDetailsEl.innerHTML = headerHtml + itemsHtml;
    return;
  }

  nodeDetailsEl.innerHTML = formatDetailsBlock("Node Data", metadata);
}

async function loadGraph() {
  setLoading(true);
  try {
    const response = await fetch("/api/graph?limit=100");
    if (!response.ok) throw new Error("Failed to fetch graph");
    const graphData = await response.json();
    const elements = toElements(graphData);

    if (!cy) {
      cy = cytoscape({
        container: document.getElementById("cy"),
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "font-size": 9,
              color: "#1f2a37",
              "background-color": "#5a9bd8",
              width: 15,
              height: 15,
              "text-wrap": "ellipsis",
              "text-max-width": 120,
            },
          },
          { selector: 'node[type = "customer"]', style: { "background-color": "#0ea5a5" } },
          { selector: 'node[type = "sales_order"]', style: { "background-color": "#4f93d2" } },
          { selector: 'node[type = "delivery"]', style: { "background-color": "#759cca" } },
          { selector: 'node[type = "invoice"]', style: { "background-color": "#0f4c81" } },
          { selector: 'node[type = "journal_entry"]', style: { "background-color": "#e11d48" } },
          { selector: 'node[type = "payment"]', style: { "background-color": "#f59e0b" } },
          {
            selector: "edge",
            style: {
              width: 1.2,
              "line-color": "#a9d1ef",
              "target-arrow-color": "#a9d1ef",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              opacity: 0.75,
            },
          },
          {
            selector: ".highlight",
            style: {
              "background-color": "#ff6b35",
              width: 23,
              height: 23,
              "line-color": "#ff8f66",
              "target-arrow-color": "#ff8f66",
              "z-index": 999,
            },
          },
          { selector: ".dim", style: { opacity: 0.12 } },
          {
            selector: ".selected",
            style: {
              "border-width": 3,
              "border-color": "#111827",
            },
          },
        ],
        layout: { name: "cose", animate: false, fit: true, randomize: true },
      });

      cy.on("tap", "node", async (evt) => {
        cy.nodes().removeClass("selected");
        const node = evt.target;
        node.addClass("selected");
        selectedNode = node.id();
        selectedNodeTagEl.textContent = selectedNode;
        expandNodeBtnEl.disabled = false;
        await showNodeDetails(selectedNode);
      });
    } else {
      cy.elements().remove();
      cy.add([...elements.nodes, ...elements.edges]);
      cy.layout({ name: "cose", animate: false, fit: true }).run();
    }

    updateStats();
  } finally {
    setLoading(false);
  }
}

async function showNodeDetails(graphNodeId) {
  const type = nodeType(graphNodeId);
  const id = encodeURIComponent(nodeKey(graphNodeId));
  const res = await fetch(`/api/graph/node/${type}/${id}`);
  if (!res.ok) {
    nodeDetailsEl.textContent = "Failed to load node details.";
    return;
  }
  const data = await res.json();
  renderNodeDetails(data);
}

async function expandSelectedNode() {
  if (!selectedNode || !cy) return;
  const type = nodeType(selectedNode);
  const id = encodeURIComponent(nodeKey(selectedNode));
  const res = await fetch(`/api/graph/expand/${type}/${id}?limit=400`);
  if (!res.ok) {
    addMessage("error", "Unable to expand this node.");
    return;
  }
  const data = await res.json();
  const elements = toElements(data);
  const existingIds = new Set(cy.elements().map((e) => e.id()));
  const toAdd = [];
  for (const n of elements.nodes) {
    if (!existingIds.has(n.data.id)) toAdd.push(n);
  }
  for (const e of elements.edges) {
    if (!existingIds.has(e.data.id)) toAdd.push(e);
  }
  if (toAdd.length) {
    cy.add(toAdd);
    cy.layout({ name: "cose", animate: true, fit: false }).run();
    updateStats();
  }
}

function applyHighlights(highlightNodeIds) {
  if (!cy) return;
  clearHighlights();
  if (!highlightNodeIds || !highlightNodeIds.length) return;

  const highlightSet = new Set(highlightNodeIds);
  cy.nodes().forEach((n) => {
    if (highlightSet.has(n.id())) n.addClass("highlight");
    else n.addClass("dim");
  });
  cy.edges().forEach((e) => {
    const src = e.source().id();
    const tgt = e.target().id();
    if (!highlightSet.has(src) && !highlightSet.has(tgt)) e.addClass("dim");
  });
}

function findNode() {
  if (!cy) return;
  const q = (nodeSearchInputEl.value || "").trim().toLowerCase();
  if (!q) return;
  const match = cy
    .nodes()
    .toArray()
    .find((n) => n.id().toLowerCase().includes(q) || String(n.data("label")).toLowerCase().includes(q));
  if (!match) {
    addMessage("error", "No node found for search text.");
    return;
  }

  cy.nodes().removeClass("selected");
  selectedNode = match.id();
  match.addClass("selected");
  selectedNodeTagEl.textContent = selectedNode;
  expandNodeBtnEl.disabled = false;
  cy.animate({
    fit: { eles: match.closedNeighborhood(), padding: 70 },
    duration: 450,
  });
  showNodeDetails(selectedNode);
}

async function askQuery(query) {
  addMessage("user", query);
  sendBtnEl.disabled = true;
  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const payload = await res.json();
    if (!res.ok) {
      addMessage("error", payload.error || "Request failed", payload.details || "");
      return;
    }

    addMessage("bot", payload.answer || "Query executed.");
    addMessage(
      "bot",
      `Intent: ${payload.intent} | Rows: ${payload.rowCount}`,
      `SQL:\n${payload.sql}\n\nResult sample:\n${JSON.stringify(payload.data.slice(0, 5), null, 2)}`
    );
    applyHighlights(payload.highlightNodeIds || []);
  } finally {
    sendBtnEl.disabled = false;
  }
}

async function runExampleQueries() {
  const examples = [
    "Which products are associated with the highest number of billing documents?",
    "Trace full flow for billing document 90504248",
    "Identify sales orders that have broken or incomplete flows (delivered but not billed)",
  ];
  for (const q of examples) {
    await askQuery(q);
  }
}

sendBtnEl.addEventListener("click", async () => {
  const query = queryInputEl.value.trim();
  if (!query) return;
  queryInputEl.value = "";
  await askQuery(query);
});

queryInputEl.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendBtnEl.click();
  }
});

runExamplesBtnEl.addEventListener("click", runExampleQueries);
expandNodeBtnEl.addEventListener("click", expandSelectedNode);
reloadGraphBtnEl.addEventListener("click", loadGraph);
fitGraphBtnEl.addEventListener("click", () => {
  if (cy) cy.fit(undefined, 40);
});
searchNodeBtnEl.addEventListener("click", findNode);
nodeSearchInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    findNode();
  }
});
clearHighlightBtnEl.addEventListener("click", clearHighlights);

for (const chip of exampleChipEls) {
  chip.addEventListener("click", async () => {
    const q = chip.getAttribute("data-q");
    if (!q) return;
    await askQuery(q);
  });
}

addMessage("bot", "Ready. Ask questions about customer->order->delivery->invoice->journal->payment flow.");

loadGraph().catch((error) => {
  addMessage("error", "Failed to initialize graph", error.message);
});
