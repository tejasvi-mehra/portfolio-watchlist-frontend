import { FormEvent, useEffect, useMemo, useState } from "react";
import { env } from "../config/env";
import { loadPortfolioPositions, loadWatchlistSymbols, saveUserConfig, type UserPosition } from "../config/userConfig";

type CatalogSymbol = {
  symbol: string;
  name: string;
};

export function ConfigurePage() {
  const [symbols, setSymbols] = useState<string[]>(() => loadWatchlistSymbols());
  const [positions, setPositions] = useState<UserPosition[]>(() => loadPortfolioPositions());
  const [symbolInput, setSymbolInput] = useState("");
  const [form, setForm] = useState({ symbol: "", qty: "", avgCost: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogSymbol[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const canSavePosition = useMemo(() => {
    return (
      /^[A-Z0-9#._-]{2,20}$/.test(form.symbol) &&
      Number(form.qty) > 0 &&
      Number(form.avgCost) >= 0
    );
  }, [form]);

  const watchlistCandidates = useMemo(
    () =>
      catalog
        .map((item) => item.symbol.trim().toUpperCase())
        .filter((symbol) => symbol && !symbols.includes(symbol)),
    [catalog, symbols],
  );

  useEffect(() => {
    if (watchlistCandidates.length === 0) {
      setSymbolInput("");
      return;
    }
    if (!symbolInput || !watchlistCandidates.includes(symbolInput)) {
      setSymbolInput(watchlistCandidates[0]);
    }
  }, [symbolInput, watchlistCandidates]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/api/symbols`);
        if (!res.ok) {
          throw new Error(`symbol api status ${res.status}`);
        }
        const json = (await res.json()) as { symbols?: CatalogSymbol[] };
        if (!cancelled) {
          setCatalog(Array.isArray(json.symbols) ? json.symbols : []);
          setCatalogError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCatalog([]);
          setCatalogError(`Failed to load symbol catalog: ${String(err)}`);
        }
      }
    };
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const addSymbol = (event: FormEvent) => {
    event.preventDefault();
    const normalized = symbolInput.trim().toUpperCase();
    if (!normalized) {
      setMessage("Pick a symbol from the available list.");
      return;
    }
    if (symbols.includes(normalized)) {
      setMessage("Symbol already exists in watchlist.");
      return;
    }
    setSymbols((prev) => [...prev, normalized]);
    setSymbolInput("");
    setMessage(null);
  };

  const removeSymbol = (symbol: string) => {
    setSymbols((prev) => prev.filter((item) => item !== symbol));
  };

  const addPosition = (event: FormEvent) => {
    event.preventDefault();
    if (!canSavePosition) {
      setMessage("Position requires valid symbol, positive qty, and non-negative avg cost.");
      return;
    }
    const newPosition: UserPosition = {
      id: `p-${Date.now()}`,
      symbol: form.symbol,
      qty: form.qty,
      avgCost: form.avgCost,
    };
    setPositions((prev) => [...prev, newPosition]);
    setForm({ symbol: "", qty: "", avgCost: "" });
    setMessage(null);
  };

  const removePosition = (id: string) => {
    setPositions((prev) => prev.filter((item) => item.id !== id));
  };

  const addCatalogSymbol = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized || symbols.includes(normalized)) return;
    setSymbols((prev) => [...prev, normalized]);
  };

  const saveConfig = () => {
    saveUserConfig(symbols, positions);
    setMessage("Saved configuration locally.");
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Configure Workspace</h2>
          <p className="muted">
            Set your watchlist and mock portfolio first. This is the source of truth for MVP pages.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveConfig}>
          Save configuration
        </button>
      </div>

      {message ? <p className="muted">{message}</p> : null}

      <div className="config-grid">
        <article className="card">
          <h3>Watchlist Symbols</h3>
          <p className="muted">Add symbols you want to follow in realtime from available symbols.</p>
          <form className="inline-form" onSubmit={addSymbol}>
            <select
              className="symbol-select"
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              aria-label="Add watchlist symbol"
              disabled={watchlistCandidates.length === 0}
            >
              {watchlistCandidates.length === 0 ? (
                <option value="">No symbols available</option>
              ) : (
                watchlistCandidates.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))
              )}
            </select>
            <button type="submit" className="btn">
              Add
            </button>
          </form>
          <div className="pill-row">
            {symbols.map((symbol) => (
              <span key={symbol} className="pill">
                {symbol}
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => removeSymbol(symbol)}
                  aria-label={`Remove ${symbol}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Mock Portfolio Positions</h3>
          <p className="muted">Used for MVP P&amp;L and portfolio value previews.</p>
          <form className="position-form" onSubmit={addPosition}>
            <input
              value={form.symbol}
              onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
              list="catalog-symbols"
              placeholder="Symbol"
              aria-label="Position symbol"
            />
            <input
              value={form.qty}
              onChange={(event) => setForm((prev) => ({ ...prev, qty: event.target.value }))}
              placeholder="Qty"
              inputMode="decimal"
              aria-label="Position quantity"
            />
            <input
              value={form.avgCost}
              onChange={(event) => setForm((prev) => ({ ...prev, avgCost: event.target.value }))}
              placeholder="Avg cost"
              inputMode="decimal"
              aria-label="Average cost"
            />
            <button type="submit" className="btn" disabled={!canSavePosition}>
              Add position
            </button>
          </form>
          <datalist id="catalog-symbols">
            {catalog.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.name}
              </option>
            ))}
          </datalist>

          <div className="table-wrap">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Avg cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td>{position.symbol}</td>
                    <td>{position.qty}</td>
                    <td>{position.avgCost}</td>
                    <td>
                      <button type="button" className="text-btn" onClick={() => removePosition(position.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3>Available Symbols (Hyperliquid)</h3>
          {catalogError ? <p className="muted">{catalogError}</p> : null}
          {catalog.length === 0 ? (
            <p className="muted">No symbols available.</p>
          ) : (
            <div className="catalog-scroll">
              <div className="pill-row">
                {catalog.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className="pill-action-btn"
                    onClick={() => addCatalogSymbol(item.symbol)}
                    title={`Add ${item.symbol} to watchlist`}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

