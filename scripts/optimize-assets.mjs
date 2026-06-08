import { stat } from "node:fs/promises";
import sharp from "sharp";

const source = "source-assets/ambient-veil.png";
const output = "public/ambient-veil.webp";

await sharp(source)
  .resize({ width: 1280, withoutEnlargement: true })
  .webp({ quality: 74, effort: 6 })
  .toFile(output);

const sourceStats = await stat(source);
const outputStats = await stat(output);

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

console.log(`Optimized ${source} (${kb(sourceStats.size)})`);
console.log(`Wrote ${output} (${kb(outputStats.size)})`);
