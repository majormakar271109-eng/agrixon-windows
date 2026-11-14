/*
 * Runs before server.mjs is evaluated.
 *
 * - Keeps the embedded server from binding a second port.
 * - In a packaged executable (pkg), public/ and .env.local are embedded in the
 *   snapshot; writable data goes to the user's application-data folder.
 * - Opens the browser and binds the sensor endpoint to the LAN by default.
 */
import path from 'node:path';
import os from 'node:os';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.APPNAME_NO_LISTEN = '1';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

if (process.pkg) {
  const dataRoot =
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'AGRIXON')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'AGRIXON')
        : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'AGRIXON');
  mkdirSync(dataRoot, { recursive: true });
  process.env.AGRIXON_ASSET_ROOT ||= sourceRoot;
  process.env.AGRIXON_DATA_DIR ||= dataRoot;
  process.env.AGRIXON_OPEN_BROWSER ||= '1';
  process.env.HOST ||= '0.0.0.0';
} else {
  process.env.AGRIXON_ASSET_ROOT ||= sourceRoot;
  process.env.AGRIXON_DATA_DIR ||= sourceRoot;
}
