export default function Knowledge() {
  return (
    <section className="knowledge">
      <header className="knowledge__header">
        <span className="knowledge__eyebrow">Graph intelligence</span>
        <h2>Coming soon: an immersive way to command institutional knowledge.</h2>
        <p>
          We&apos;re crafting the Knowledge Graph experience — a living map of objectives, context,
          and dependencies so teams can spot leverage in seconds.
        </p>
      </header>

      <div className="knowledge__grid">
        <article className="panel panel--primary knowledge__panel">
          <h3>Experience in design</h3>
          <ul className="knowledge__list">
            <li>
              <span className="knowledge__badge knowledge__badge--active">In flight</span>
              <div>
                <strong>Interactive objective atlas</strong>
                <p>Navigate clusters, dependencies, and momentum across your entire graph.</p>
              </div>
            </li>
            <li>
              <span className="knowledge__badge">Early concept</span>
              <div>
                <strong>Semantic search &amp; signal overlays</strong>
                <p>Query by intent, layer team sentiment, and surface buried knowledge.</p>
              </div>
            </li>
            <li>
              <span className="knowledge__badge">Prototype</span>
              <div>
                <strong>Executive briefing mode</strong>
                <p>Instantly synthesize OKR health and cross-functional initiatives.</p>
              </div>
            </li>
          </ul>
        </article>

        <aside className="panel panel--secondary knowledge__panel">
          <h3>Planned launch highlights</h3>
          <div className="knowledge__highlights">
            <div>
              <span className="knowledge__metric">Q4</span>
              <p>Beta access for design partners</p>
            </div>
            <div>
              <span className="knowledge__metric">Live</span>
              <p>Real-time graph walkthroughs with AI narration</p>
            </div>
            <div>
              <span className="knowledge__metric">Export</span>
              <p>Sync insights to decks, Notion, and analytics suites</p>
            </div>
          </div>

          <div className="knowledge__cta">
            <p>Need early access? We&apos;re onboarding a small set of teams shaping the roadmap.</p>
            <a className="knowledge__link" href="mailto:hello@visium.ai">Join the waitlist →</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
