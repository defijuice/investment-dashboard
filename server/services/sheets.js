import { GoogleSheetsClient } from '../../src/googleSheets.js';

let sheetsClient = null;

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = new GoogleSheetsClient();
    await sheetsClient.init();
  }
  return sheetsClient;
}

export { sheetsClient };
