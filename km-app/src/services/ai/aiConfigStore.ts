/**
 * Lightweight module-level AI config store.
 * No dependencies on stores or any other modules — zero circular-dep risk.
 *
 * Updated by: useSettingsStore.load() / updateAIConfig()
 * Read by:    aiClient.callAI()
 */

let _apiKey = '';
let _baseURL = '';
let _model = '';

export function setAIConfig(apiKey: string, baseURL: string, model: string): void {
  _apiKey = apiKey || '';
  _baseURL = baseURL || '';
  _model = model || '';
}

export function getAIConfig(): { apiKey: string; baseURL: string; model: string } {
  return { apiKey: _apiKey, baseURL: _baseURL, model: _model };
}
