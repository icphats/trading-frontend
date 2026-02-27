export type ChartView = "candle" | "line";

export type DataLayerKey = "oracle" | "volume";

export type TradingOverlayKey =
  | "avgEntry"
  | "avgEntry"
  | "triggers"
  | "limitOrders"
  | "liquidation";

export type PriceBasis = "icp" | "usd";

export type ChartInterval = "1m" | "15m" | "1h" | "4h" | "1d";

export interface ChartSettingsState {
  view: ChartView;
  layers: Record<DataLayerKey, boolean>;
  trading: Record<TradingOverlayKey, boolean>;
  priceBasis: PriceBasis;
  interval: ChartInterval;
}

export const chartSettings = $state<ChartSettingsState>({
  view: "candle",
  layers: {
    oracle: true,
    volume: false,
  },
  trading: {
    avgEntry: false,
    triggers: false,
    limitOrders: false,
    liquidation: false,
  },
  priceBasis: "icp",
  interval: "1h",
});

export function setChartView(view: ChartView) {
  chartSettings.view = view;
}

export function toggleLayer(key: DataLayerKey) {
  chartSettings.layers[key] = !chartSettings.layers[key];
}

export function setLayer(key: DataLayerKey, value: boolean) {
  chartSettings.layers[key] = value;
}

export function toggleTradingOverlay(key: TradingOverlayKey) {
  chartSettings.trading[key] = !chartSettings.trading[key];
}

export function setTradingOverlay(key: TradingOverlayKey, value: boolean) {
  chartSettings.trading[key] = value;
}

export function setPriceBasis(basis: PriceBasis) {
  chartSettings.priceBasis = basis;
}

export function setChartInterval(interval: ChartInterval) {
  chartSettings.interval = interval;
}
