export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Red Planet Corporate — API server</h1>
      <p>
        This service exposes the JSON API for Red Planet Corporate. There is no player UI here
        (that is a separate frontend). See <code>apps/web/README.md</code> for the full route list
        and request/response shapes.
      </p>
      <p>Health check: <code>GET /api/health</code></p>
    </main>
  );
}
