import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { config } from '../config';
import { logger } from '../utils/logger';
import { describeWeather, formatTemp } from '../utils/formatWeather';
import { WeatherSnapshot } from './weatherService';
import { pickWish } from './wishService';

dayjs.locale('ru');

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'templates', 'weatherCard.html');

function formatTimeFromIso(iso: string): string {
  return dayjs(iso).format('HH:mm');
}

function formatWeekday(dateStr: string): string {
  const w = dayjs(dateStr).format('dddd');
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function formatWeekdayUpper(dateStr: string): string {
  return dayjs(dateStr).format('dddd').toUpperCase();
}

function formatDateLong(dateStr: string): string {
  return dayjs(dateStr).format('D MMMM');
}

function weatherClass(code: number): string {
  // WMO -> визуальная категория
  if (code <= 1) return 'wx-clear';
  if (code <= 3) return 'wx-cloudy';
  if (code === 45 || code === 48) return 'wx-fog';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'wx-sleet';
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return 'wx-rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'wx-snow';
  if (code >= 95) return 'wx-thunder';
  return 'wx-clear';
}

function tempClass(temp: number): string {
  const t = Math.round(temp);
  if (t <= 0) return 'temp-cold';
  if (t <= 10) return 'temp-chilly';
  if (t <= 18) return 'temp-mild';
  if (t <= 25) return 'temp-warm';
  return 'temp-hot';
}

export async function renderCard(weather: WeatherSnapshot): Promise<string> {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
  const description = describeWeather(weather.sunsetWeatherCode);
  const bodyClass = `${weatherClass(weather.sunsetWeatherCode)} ${tempClass(weather.sunsetTemp)}`;

  const wish = pickWish({
    temp: weather.sunsetTemp,
    feelsLike: weather.sunsetFeelsLike,
    wind: weather.sunsetWind,
    weatherCode: weather.sunsetWeatherCode,
    sunset: new Date(weather.sunset),
  });

  const html = template
    .replaceAll('{{WIDTH}}', String(config.card.width))
    .replaceAll('{{HEIGHT}}', String(config.card.height))
    .replaceAll('{{CITY}}', weather.city)
    .replaceAll('{{CITY_UPPER}}', weather.city.toUpperCase())
    .replaceAll('{{WEEKDAY}}', formatWeekday(weather.date))
    .replaceAll('{{WEEKDAY_UPPER}}', formatWeekdayUpper(weather.date))
    .replaceAll('{{DATE_LONG}}', formatDateLong(weather.date))
    .replaceAll('{{EMOJI}}', description.emoji)
    .replaceAll('{{TEMP_SUNSET}}', formatTemp(weather.sunsetTemp))
    .replaceAll('{{WEATHER_LABEL}}', description.label)
    .replaceAll('{{FEELS_LIKE}}', formatTemp(weather.sunsetFeelsLike))
    .replaceAll('{{SUNSET}}', formatTimeFromIso(weather.sunset))
    .replaceAll('{{WIND}}', weather.sunsetWind.toFixed(1))
    .replaceAll('{{WISH}}', wish)
    .replaceAll('{{BODY_CLASS}}', bodyClass);

  await fs.mkdir(path.dirname(config.card.outputPath), { recursive: true });

  logger.info('Launching Puppeteer to render card');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: config.card.width,
      height: config.card.height,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({
      path: config.card.outputPath as `${string}.png`,
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: config.card.width,
        height: config.card.height,
      },
    });
    logger.info(`Card saved to ${config.card.outputPath}`);
  } finally {
    await browser.close();
  }

  return config.card.outputPath;
}
