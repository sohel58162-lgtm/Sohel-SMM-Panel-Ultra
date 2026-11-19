/**
 * Provider integration boundary.
 * Implement only against a provider's current official API and terms.
 * Keep API credentials in server environment variables; never send them to the browser.
 */
export async function submitProviderOrder({ service, targetUrl, quantity }) {
  // Deliberately not wired to a third-party provider yet.
  // Validate provider service mapping and authorization before enabling live orders.
  return {
    accepted: false,
    reason: "Provider integration is not configured. Configure an approved provider first."
  };
}
