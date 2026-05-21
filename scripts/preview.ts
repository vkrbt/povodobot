/**
 * Локальный превью карточки без обращения в Telegram и Open-Meteo.
 * Запуск: npx ts-node scripts/preview.ts
 */
import { renderCard } from '../src/services/cardRenderer';

const sunset = new Date();
sunset.setHours(21, 14, 0, 0);

renderCard({
  city: 'Минск',
  date: new Date().toISOString().slice(0, 10),
  sunsetTemp: 18.3,
  sunsetFeelsLike: 16.8,
  sunsetWind: 4.2,
  sunsetWeatherCode: 2,
  sunset: sunset.toISOString(),
  sunrise: new Date(new Date().setHours(5, 12, 0, 0)).toISOString(),
})
  .then((p) => console.log('Saved:', p))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
