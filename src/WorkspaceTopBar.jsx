import { Link } from "./router.jsx";
import TechText from "./TechText.jsx";

// Compact bar for the app views — distinct from the marketing CardNav used
// on the landing page, but built from the same materials: the identical
// TechText config (just a smaller box) and the homepage's own dark/hairline
// language, not a bespoke "app chrome" palette.
export default function WorkspaceTopBar({ crumb }) {
  return (
    <header className="workspace-topbar">
      <Link to="/" className="workspace-wordmark" aria-label="Asterism home">
        <TechText
          text="Asterism"
          fontWeight={600}
          fontSize={40}
          color="#FFFFFF"
          accentColor="#9CA3AF"
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
      <span className="workspace-crumb">
        Workspace
        {crumb && (
          <>
            <span aria-hidden="true">/</span>
            <strong>{crumb}</strong>
          </>
        )}
      </span>
      <Link to="/" className="workspace-home-link">
        ← Home
      </Link>
    </header>
  );
}
