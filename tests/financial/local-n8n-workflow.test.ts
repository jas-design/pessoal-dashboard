import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL(
  "../../n8n/workflows/09b-local-financial-extraction.blocked.json",
  import.meta.url,
);

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
}

interface WorkflowExport {
  active: boolean;
  nodes: WorkflowNode[];
  meta: {
    localOnly: boolean;
    persistenceBlocked: boolean;
    contractVersion: string;
  };
}

test("workflow 09B é local, manual, desativado e bloqueado antes da escrita", async () => {
  const source = await readFile(workflowPath, "utf8");
  const workflow = JSON.parse(source) as WorkflowExport;

  assert.equal(workflow.active, false);
  assert.equal(workflow.meta.localOnly, true);
  assert.equal(workflow.meta.persistenceBlocked, true);
  assert.equal(workflow.meta.contractVersion, "09B.1");
  assert.equal(workflow.nodes[0]?.type, "n8n-nodes-base.manualTrigger");
  assert.ok(workflow.nodes.some(
    (node) => node.name === "Stop before incompatible persistence",
  ));
  assert.equal(workflow.nodes.some(
    (node) => /supabase|postgres/i.test(node.type),
  ), false);
});

test("workflow não contém endpoint remoto nem segredo incorporado", async () => {
  const source = await readFile(workflowPath, "utf8");
  const workflow = JSON.parse(source) as WorkflowExport;
  const httpNode = workflow.nodes.find(
    (node) => node.name === "Invoke private XLSX worker",
  );

  assert.equal(
    httpNode?.parameters.url,
    "http://financial-xlsx-worker:8787/v1/extractions/xlsx",
  );
  assert.deepEqual(httpNode?.credentials, {
    httpHeaderAuth: {
      id: "SELECT_LOCAL_WORKER_CREDENTIAL_AFTER_IMPORT",
      name: "LOCAL_ONLY_FINANCIAL_XLSX_WORKER",
    },
  });
  assert.doesNotMatch(source, /https:\/\//i);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}/);
});
