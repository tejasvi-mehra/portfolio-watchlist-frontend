import { NavLink, Outlet } from "react-router-dom";
import { env } from "../../config/env";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  fontWeight: isActive ? 700 : 500,
  marginRight: "1rem",
  textDecoration: "none",
});

export function AppShell() {
  return (
    <div className="page">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>{env.appName}</h1>
        <nav>
          <NavLink to="/configure" style={linkStyle}>
            Configure
          </NavLink>
          <NavLink to="/watchlist" style={linkStyle}>
            Watchlist
          </NavLink>
          <NavLink to="/portfolio" style={linkStyle}>
            Portfolio
          </NavLink>
        </nav>
      </header>
      <hr />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
