export type Symbol = string;

export type Quote = {
  symbol: Symbol;
  lastPrice: string;
  updatedAt: string;
};

export type Position = {
  symbol: Symbol;
  qty: string;
  avgCost: string;
};
