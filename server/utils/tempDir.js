import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER_TEMP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'temp');

function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// Where the server keeps its log, speech and experiment files: server/temp, or
// a folder in the system's temporary directory where the server's own folder
// is read-only, as in the hosted site's function (netlify/functions/api.mjs).
export const TEMP_DIR = isWritable(SERVER_TEMP_DIR)
  ? SERVER_TEMP_DIR
  : path.join(os.tmpdir(), 'stepwrite');

fs.mkdirSync(TEMP_DIR, { recursive: true });
