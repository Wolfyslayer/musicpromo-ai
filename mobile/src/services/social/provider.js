/**
 * Social provider contracts (Phase 2D foundation).
 * Methods exist so future OAuth/publishing can plug in without rewriting the Hub.
 * None of these call real platform APIs yet.
 */

export const CONNECTION_STATUS = {
  NOT_CONNECTED: "not_connected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "connection_error",
  UNAVAILABLE: "unavailable",
};

export const CONNECTION_STATUS_META = {
  [CONNECTION_STATUS.NOT_CONNECTED]: { label: "Not connected", color: "muted" },
  [CONNECTION_STATUS.CONNECTING]: { label: "Connecting", color: "primary" },
  [CONNECTION_STATUS.CONNECTED]: { label: "Connected", color: "chart-2" },
  [CONNECTION_STATUS.ERROR]: { label: "Connection error", color: "chart-3" },
  [CONNECTION_STATUS.UNAVAILABLE]: { label: "Not configured", color: "muted" },
};

/**
 * Create a stub provider adapter. Real OAuth implementations will replace these methods later.
 */
export function createProviderStub(config) {
  const notImplemented = (action) => async () => {
    throw new Error(`${config.name}: ${action} is not available yet. Platform OAuth will ship in a later phase.`);
  };

  return {
    id: config.id,
    name: config.name,
    config,
    getConnectionStatus: async () => CONNECTION_STATUS.UNAVAILABLE,
    connect: notImplemented("connect"),
    disconnect: notImplemented("disconnect"),
    publish: notImplemented("publish"),
    schedule: notImplemented("schedule"),
    getProfile: notImplemented("getProfile"),
    getPosts: notImplemented("getPosts"),
    getAnalytics: notImplemented("getAnalytics"),
  };
}
