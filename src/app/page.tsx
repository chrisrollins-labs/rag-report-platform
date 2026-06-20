export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem", lineHeight: 1.6 }}>
      <h1>rag-report-platform</h1>
      <p>
        A reference implementation for retrieval-grounded, multi-source AI report
        generation. The engineering is the product: provider-abstracted model calls,
        layered caching, graceful degradation, cost instrumentation, and an evaluation
        harness.
      </p>
      <p>
        Generate a report by posting to <code>/api/reports</code>:
      </p>
      <pre style={{ background: "#f4f4f5", padding: "1rem", borderRadius: 8, overflowX: "auto" }}>
{`curl -X POST /api/reports \\
  -H 'content-type: application/json' \\
  -d '{
    "subject": "coastal site conditions",
    "region": "central gulf coast",
    "period": "october",
    "targetDate": "2026-10-15"
  }'`}
      </pre>
      <p>
        See <code>README.md</code> and <code>docs/</code> for architecture, ADRs, and the
        design rationale.
      </p>
    </main>
  );
}
