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

// Шрифты лежат в assets/fonts/ и инлайнятся в страницу.
// Скачивает их `npm run fetch-fonts`.
const ASSETS_DIRS = [
  path.resolve(__dirname, '..', '..', 'assets', 'fonts'),
  path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts'),
];

interface FontFace {
  file: string;
  family: string;
  format: 'truetype' | 'woff2' | 'opentype';
  mime: string;
  weight?: string;
  style?: string;
}

const FONT_FACES: FontFace[] = [
  {
    file: 'Inter-Variable.woff2',
    family: 'Inter',
    format: 'woff2',
    mime: 'font/woff2',
    weight: '100 900',
    style: 'normal',
  },
  {
    file: 'Inter-Variable-Italic.woff2',
    family: 'Inter',
    format: 'woff2',
    mime: 'font/woff2',
    weight: '100 900',
    style: 'italic',
  },
  {
    file: 'AppleColorEmoji-Linux.ttf',
    family: 'Apple Color Emoji Linux',
    format: 'truetype',
    mime: 'font/ttf',
    weight: 'normal',
    style: 'normal',
  },
];

let fontFaceCss: string | null | undefined;

async function findFont(file: string): Promise<string | null> {
  for (const dir of ASSETS_DIRS) {
    const candidate = path.join(dir, file);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

async function buildFontFaceCss(): Promise<string | null> {
  if (fontFaceCss !== undefined) return fontFaceCss;
  const blocks: string[] = [];
  for (const face of FONT_FACES) {
    const filePath = await findFont(face.file);
    if (!filePath) {
      logger.warn(`Font ${face.file} not found in assets/fonts/. Run \`npm run fetch-fonts\`. The card may look off.`);
      continue;
    }
    // Use file:// URLs instead of base64 data URIs — the emoji font is ~110 MB
    // and base64-inlining it crashes Chrome's CDP protocol (message too large).
    const lines = [
      '@font-face {',
      `  font-family: '${face.family}';`,
      `  src: url('file://${filePath}') format('${face.format}');`,
      face.weight ? `  font-weight: ${face.weight};` : '',
      face.style ? `  font-style: ${face.style};` : '',
      '  font-display: block;',
      '}',
    ].filter(Boolean);
    blocks.push(lines.join('\n'));
  }
  if (blocks.length === 0) {
    fontFaceCss = null;
    return fontFaceCss;
  }
  logger.info(`Prepared ${blocks.length} @font-face rules (file:// refs)`);
  fontFaceCss = blocks.join('\n');
  return fontFaceCss;
}

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

// Анкеры цветовой шкалы: [temp, topColor, bottomColor].
// Шаг отрисовки — 2°C (см. tempGradient ниже).
const TEMP_SCALE: Array<[number, [number, number, number], [number, number, number]]> = [
  [-24, [80, 80, 200], [30, 30, 110]],   // лютый мороз — индиго
  [-12, [110, 175, 235], [40, 80, 165]], // мороз — голубой
  [ -2, [140, 220, 235], [60, 130, 175]],// около нуля — лёд
  [  6, [170, 220, 175], [85, 145, 100]],// прохлада — мятный
  [ 14, [255, 200, 110], [205, 130,  55]],// тепло — янтарь
  [ 22, [255, 130,  70], [200,  55,  60]],// жара — закатный
  [ 32, [220,  40,  40], [120,   5,  20]] // пекло — раскалённый красный
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

function tempGradient(tempCelsius: number): string {
  // Округляем до шага 2°C — на этом шаге заметно меняется оттенок.
  const t = Math.round(tempCelsius / 2) * 2;
  const clamped = Math.max(TEMP_SCALE[0][0], Math.min(TEMP_SCALE[TEMP_SCALE.length - 1][0], t));

  let lower = TEMP_SCALE[0];
  let upper = TEMP_SCALE[TEMP_SCALE.length - 1];
  for (let i = 0; i < TEMP_SCALE.length - 1; i++) {
    if (clamped >= TEMP_SCALE[i][0] && clamped <= TEMP_SCALE[i + 1][0]) {
      lower = TEMP_SCALE[i];
      upper = TEMP_SCALE[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0];
  const k = span === 0 ? 0 : (clamped - lower[0]) / span;
  const top = lerpColor(lower[1], upper[1], k);
  const bot = lerpColor(lower[2], upper[2], k);
  return `linear-gradient(180deg, ${top} 0%, ${bot} 100%)`;
}

export async function renderCard(weather: WeatherSnapshot): Promise<string> {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
  const description = describeWeather(weather.sunsetWeatherCode);
  const bodyClass = weatherClass(weather.sunsetWeatherCode);
  const tempGrad = tempGradient(weather.sunsetTemp);

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
    .replaceAll('{{BODY_CLASS}}', bodyClass)
    .replaceAll('{{TEMP_GRADIENT}}', tempGrad);

  await fs.mkdir(path.dirname(config.card.outputPath), { recursive: true });

  // Inject @font-face CSS (with file:// URLs) into the HTML.
  // We write the result to a temp file and navigate via file:// so Chrome loads
  // fonts directly from disk — avoids pushing ~150 MB of base64 through CDP.
  const fCss = await buildFontFaceCss();
  const finalHtml = fCss
    ? html.replace('</head>', `<style>\n${fCss}\n</style>\n</head>`)
    : html;
  const tmpHtml = path.join(path.dirname(config.card.outputPath), '_card.html');
  await fs.writeFile(tmpHtml, finalHtml);

  logger.info('Launching Puppeteer to render card');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--allow-file-access-from-files',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: config.card.width,
      height: config.card.height,
      deviceScaleFactor: 1,
    });
    await page.goto(`file://${path.resolve(tmpHtml)}`, { waitUntil: 'load' });
    if (fCss) {
      // Дождаться, пока браузер реально распарсит и подгрузит шрифт из file:// URL.
      await page.evaluate('document.fonts.ready');
    }
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
    await fs.unlink(tmpHtml).catch(() => {});
  }

  return config.card.outputPath;
}
