import { Link } from "./router.jsx";
import TechText from "./TechText.jsx";

// Compact bar for the app views — distinct from the marketing CardNav used
// on the landing page: just the wordmark (same TechText treatment as the
// hero, shrunk to fit its box), a quiet "you are here" cue, and a way back.
export default function WorkspaceTopBar({ crumb }) {
  return (
    <header className="workspace-topbar">
      <Link to="/" className="workspace-wordmark" aria-label="Constellation home">
        <TechText
          text="Constellation"
          fontWeight={600}
          fontSize={40}
          color="#E5E7EB"
          accentColor="#67E8F9"
          reveal="letter"
          lineStyle="dashed"
          selection={false}
          labels={false}
          draggable={false}
          sweep={false}
          specks={0}
          dashLength={3}
          dashGap={2}
          strokeWidth={1}
        />
      </Link>
      <span className="workspace-mode" aria-hidden="true">
        Workspace
      </span>
      {crumb && (
        <span className="workspace-crumb">
          <span aria-hidden="true">/</span> {crumb}
        </span>
      )}
      <Link to="/" className="workspace-home-link">
        ← Home
      </Link>
    </header>
  );
}
