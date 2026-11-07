const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function extractZipFile(zipBuf, targetFileName) {
  let offset = 0;
  while (offset < zipBuf.length - 4) {
    if (zipBuf.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const compression = zipBuf.readUInt16LE(offset + 8);
    const compSize = zipBuf.readUInt32LE(offset + 18);
    const uncompSize = zipBuf.readUInt32LE(offset + 22);
    const fnLen = zipBuf.readUInt16LE(offset + 26);
    const extraLen = zipBuf.readUInt16LE(offset + 28);
    const fn = zipBuf.toString('utf8', offset + 30, offset + 30 + fnLen);
    const dataStart = offset + 30 + fnLen + extraLen;

    if (fn.endsWith('/' + targetFileName) || fn === targetFileName) {
      const compData = zipBuf.subarray(dataStart, dataStart + compSize);
      if (compression === 8) {
        return zlib.inflateRawSync(compData);
      } else if (compression === 0) {
        return compData;
      }
    }
    offset = dataStart + compSize;
  }
  return null;
}

async function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    function get(u) {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download ${u}: HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    }
    get(url);
  });
}

async function ensureRclone() {
  const isWin = process.platform === 'win32';
  const binDir = path.join(__dirname, '..', 'bin');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  const targetBinName = isWin ? 'rclone.exe' : 'rclone';
  const targetBinPath = path.join(binDir, targetBinName);

  if (fs.existsSync(targetBinPath) && fs.statSync(targetBinPath).size > 1000000) {
    console.log(`[ensure-rclone] Rclone binary already present at ${targetBinPath} (${(fs.statSync(targetBinPath).size / 1024 / 1024).toFixed(1)} MB)`);
    if (!isWin) {
      try { fs.chmodSync(targetBinPath, 0o755); } catch (e) {}
    }
    return targetBinPath;
  }

  // Also check system candidates
  const sysCandidates = isWin
    ? ['C:\\rclone\\rclone.exe', path.join(process.env.ProgramFiles || 'C:\\Program Files', 'rclone', 'rclone.exe')]
    : ['/usr/bin/rclone', '/usr/local/bin/rclone'];

  for (const c of sysCandidates) {
    if (fs.existsSync(c)) {
      console.log(`[ensure-rclone] Found system rclone at ${c}`);
      return c;
    }
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const zipName = isWin ? `rclone-current-windows-${arch}.zip` : `rclone-current-linux-${arch}.zip`;
  const url = `https://downloads.rclone.org/${zipName}`;

  console.log(`[ensure-rclone] Downloading rclone for ${process.platform}-${arch} from ${url}...`);
  const start = Date.now();
  const zipBuf = await downloadBuffer(url);
  console.log(`[ensure-rclone] Downloaded ${(zipBuf.length / 1024 / 1024).toFixed(1)} MB in ${Date.now() - start}ms. Extracting ${targetBinName}...`);

  const binBuf = extractZipFile(zipBuf, targetBinName);
  if (!binBuf || binBuf.length === 0) {
    throw new Error(`Could not find ${targetBinName} inside downloaded zip`);
  }

  fs.writeFileSync(targetBinPath, binBuf);
  if (!isWin) {
    try { fs.chmodSync(targetBinPath, 0o755); } catch (e) {}
  }
  console.log(`[ensure-rclone] Successfully installed ${targetBinName} to ${targetBinPath} (${(binBuf.length / 1024 / 1024).toFixed(1)} MB)`);
  return targetBinPath;
}

if (require.main === module) {
  ensureRclone().catch(err => {
    console.error('[ensure-rclone] Error:', err.message);
  });
}

module.exports = { ensureRclone, extractZipFile };
