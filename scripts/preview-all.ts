/**
 * Генерирует превью карточки для всех WMO-кодов погоды.
 * Каждый код получает реалистичный для него набор температуры/ветра/времени заката.
 * Файлы сохраняются в output/variants/<code>-<slug>.png.
 *
 * Запуск: npx ts-node scripts/preview-all.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { renderCard } from '../src/services/cardRenderer';
import { config } from '../src/config';

interface Variant {
  code: number;
  slug: string;
  temp: number;
  feelsLike: number;
  wind: number;
  sunsetHour: number;
  sunsetMin: number;
}

// Подобраны правдоподобные сценарии для Минска: для снега — мороз,
// для жары — лето с поздним закатом, для гроз — тёплый ливневый вечер и т.п.
const VARIANTS: Variant[] = [
  { code: 0,  slug: 'clear',                 temp: 22, feelsLike: 21, wind: 2.5, sunsetHour: 21, sunsetMin: 30 },
  { code: 1,  slug: 'mainly-clear',          temp: 19, feelsLike: 18, wind: 3.0, sunsetHour: 21, sunsetMin: 14 },
  { code: 2,  slug: 'partly-cloudy',         temp: 17, feelsLike: 16, wind: 4.2, sunsetHour: 20, sunsetMin: 45 },
  { code: 3,  slug: 'overcast',              temp: 12, feelsLike: 10, wind: 5.0, sunsetHour: 19, sunsetMin: 20 },
  { code: 45, slug: 'fog',                   temp: 6,  feelsLike: 4,  wind: 1.5, sunsetHour: 17, sunsetMin: 40 },
  { code: 48, slug: 'depositing-rime-fog',   temp: -3, feelsLike: -6, wind: 2.0, sunsetHour: 16, sunsetMin: 50 },
  { code: 51, slug: 'drizzle-light',         temp: 11, feelsLike: 9,  wind: 3.5, sunsetHour: 20, sunsetMin: 10 },
  { code: 53, slug: 'drizzle-moderate',      temp: 10, feelsLike: 8,  wind: 4.0, sunsetHour: 19, sunsetMin: 50 },
  { code: 55, slug: 'drizzle-dense',         temp: 9,  feelsLike: 6,  wind: 5.5, sunsetHour: 19, sunsetMin: 30 },
  { code: 56, slug: 'freezing-drizzle-light',temp: 0,  feelsLike: -3, wind: 4.0, sunsetHour: 17, sunsetMin: 10 },
  { code: 57, slug: 'freezing-drizzle-dense',temp: -2, feelsLike: -7, wind: 6.0, sunsetHour: 16, sunsetMin: 55 },
  { code: 61, slug: 'rain-slight',           temp: 13, feelsLike: 11, wind: 4.0, sunsetHour: 20, sunsetMin: 30 },
  { code: 63, slug: 'rain-moderate',         temp: 12, feelsLike: 9,  wind: 5.5, sunsetHour: 20, sunsetMin: 0 },
  { code: 65, slug: 'rain-heavy',            temp: 14, feelsLike: 11, wind: 7.0, sunsetHour: 19, sunsetMin: 40 },
  { code: 66, slug: 'freezing-rain-light',   temp: 0,  feelsLike: -4, wind: 4.5, sunsetHour: 17, sunsetMin: 0  },
  { code: 67, slug: 'freezing-rain-heavy',   temp: -1, feelsLike: -6, wind: 6.5, sunsetHour: 16, sunsetMin: 45 },
  { code: 71, slug: 'snow-slight',           temp: -2, feelsLike: -5, wind: 3.0, sunsetHour: 16, sunsetMin: 30 },
  { code: 73, slug: 'snow-moderate',         temp: -5, feelsLike: -9, wind: 4.5, sunsetHour: 16, sunsetMin: 20 },
  { code: 75, slug: 'snow-heavy',            temp: -10,feelsLike: -16,wind: 6.0, sunsetHour: 16, sunsetMin: 10 },
  { code: 77, slug: 'snow-grains',           temp: -7, feelsLike: -12,wind: 5.0, sunsetHour: 16, sunsetMin: 15 },
  { code: 80, slug: 'rain-showers-slight',   temp: 16, feelsLike: 14, wind: 5.0, sunsetHour: 20, sunsetMin: 50 },
  { code: 81, slug: 'rain-showers-moderate', temp: 18, feelsLike: 16, wind: 6.5, sunsetHour: 21, sunsetMin: 0  },
  { code: 82, slug: 'rain-showers-violent',  temp: 20, feelsLike: 18, wind: 9.5, sunsetHour: 21, sunsetMin: 10 },
  { code: 85, slug: 'snow-showers-slight',   temp: -3, feelsLike: -7, wind: 4.0, sunsetHour: 16, sunsetMin: 40 },
  { code: 86, slug: 'snow-showers-heavy',    temp: -8, feelsLike: -14,wind: 7.5, sunsetHour: 16, sunsetMin: 20 },
  { code: 95, slug: 'thunderstorm',          temp: 23, feelsLike: 23, wind: 7.0, sunsetHour: 21, sunsetMin: 20 },
  { code: 96, slug: 'thunderstorm-hail-slight', temp: 24, feelsLike: 24, wind: 9.0, sunsetHour: 21, sunsetMin: 25 },
  { code: 99, slug: 'thunderstorm-hail-heavy',  temp: 26, feelsLike: 27, wind: 11.0, sunsetHour: 21, sunsetMin: 30 },
];

async function main(): Promise<void> {
  const outDir = path.resolve('output', 'variants');
  await fs.mkdir(outDir, { recursive: true });

  // дата под каждый вариант — берём сегодняшнюю, день недели не важен для превью
  const dateStr = new Date().toISOString().slice(0, 10);

  console.log(`Rendering ${VARIANTS.length} variants → ${outDir}`);

  for (const v of VARIANTS) {
    const sunset = new Date();
    sunset.setHours(v.sunsetHour, v.sunsetMin, 0, 0);
    const sunrise = new Date();
    sunrise.setHours(5, 30, 0, 0);

    await renderCard({
      city: 'Минск',
      date: dateStr,
      sunsetTemp: v.temp,
      sunsetFeelsLike: v.feelsLike,
      sunsetWind: v.wind,
      sunsetWeatherCode: v.code,
      sunset: sunset.toISOString(),
      sunrise: sunrise.toISOString(),
    });

    const target = path.join(
      outDir,
      `${String(v.code).padStart(2, '0')}-${v.slug}.png`,
    );
    await fs.copyFile(config.card.outputPath, target);
    console.log(`  ✔ code ${String(v.code).padStart(2)} → ${path.basename(target)}`);
  }

  console.log(`Done. ${VARIANTS.length} cards saved.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
