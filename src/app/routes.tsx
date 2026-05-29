import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AssetDetailPage } from "../pages/AssetDetailPage";
import { ConfigurePage } from "../pages/ConfigurePage";
import { PortfolioPage } from "../pages/PortfolioPage";
import { WatchlistPage } from "../pages/WatchlistPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/configure" replace />} />
        <Route path="/configure" element={<ConfigurePage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/asset/:symbol" element={<AssetDetailPage />} />
      </Route>
    </Routes>
  );
}
