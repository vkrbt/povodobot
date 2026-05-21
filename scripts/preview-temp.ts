/**
 * Превью градиента температуры по шагу 2°C: -24…+32.
 * Сохраняет PNG для каждой ступени в output/temp/.
 *
 * Запуск: npx ts-node scripts/preview-temp.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { renderCard } from '../src/services/cardRenderer';
import { config } from '../src/config';

async function main(): Promise<void> {
  const outDir = path.resolve('output', 'temp');
  await fs.mkdir(outDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const sunset = new Date();
  sunset.setHours(21, 0, 0, 0);
  const sunrise = new Date();
  sunrise.setHours(5, 30, 0, 0);

  for (let t = -24; t <= 32; t += 2) {
    await renderCard({
      city: 'Минск',
      date: dateStr,
      sunsetTemp: t,
      sunsetFeelsLike: t - 2,
      sunsetWind: 3.0,
      // 2 = переменная облачность — нейтральный фон, чтобы был виден только цвет температуры
      sunsetWeatherCode: 2,
      sunset: sunset.toISOString(),
      sunrise: sunrise.toISOString(),
    });

    const sign = t >= 0 ? `p${t}` : `m${Math.abs(t)}`;
    const target = path.join(outDir, `t-${sign}.png`);
    await fs.copyFile(config.card.outputPath, target);
    console.log(`  ✔ ${t > 0 ? '+' : ''}${t}°C → ${path.basename(target)}`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
