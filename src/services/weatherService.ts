import { config } from '../config';
import { logger } from '../utils/logger';

export interface WeatherSnapshot {
  city: string;
  date: string; // YYYY-MM-DD по локальному tz
  /** Средняя температура в окне ±1ч от заката. */
  sunsetTemp: number;
  /** Средняя "ощущается как" в окне ±1ч от заката. */
  sunsetFeelsLike: number;
  /** Средняя скорость ветра, м/с, в окне ±1ч от заката. */
  sunsetWind: number;
  /** Преобладающий weather code в окне ±1ч от заката. */
  sunsetWeatherCode: number;
  sunset: string; // local ISO
  sunrise: string;
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mostFrequent(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Open-Meteo возвращает hourly.time как "YYYY-MM-DDTHH:00" в локальной
 * таймзоне запроса. Возвращаем индекс единственного часа, ближайшего к
 * закату — нам нужна температура/ветер/код именно «на закате», без
 * усреднения по соседним часам (раньше брали ±1 час, что давало
 * скорее «вечернее среднее»).
 */
function selectSunsetHourIndex(times: string[], sunset: string): number {
  const sunsetTime = new Date(sunset).getTime();
  let nearest = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const delta = Math.abs(t - sunsetTime);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = i;
    }
  }
  return nearest;
}

export async function fetchWeather(): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(config.city.latitude),
    longitude: String(config.city.longitude),
    timezone: config.timezone,
    hourly:
      'temperature_2m,apparent_temperature,wind_speed_10m,weather_code',
    daily: 'sunrise,sunset',
    forecast_days: '1',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  logger.info(`Fetching weather: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as OpenMeteoResponse;

  if (!data.daily || !data.daily.sunset || data.daily.sunset.length === 0) {
    throw new Error('Open-Meteo returned empty daily forecast');
  }
  if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
    throw new Error('Open-Meteo returned empty hourly forecast');
  }

  const sunset = data.daily.sunset[0];
  const i = selectSunsetHourIndex(data.hourly.time, sunset);
  logger.info(
    `Sunset weather: sunset=${sunset}, using hourly slot ${data.hourly.time[i]} (idx=${i})`,
  );

  return {
    city: config.city.name,
    date: data.daily.time[0],
    sunsetTemp: data.hourly.temperature_2m[i],
    sunsetFeelsLike: data.hourly.apparent_temperature[i],
    sunsetWind: data.hourly.wind_speed_10m[i],
    sunsetWeatherCode: data.hourly.weather_code[i],
    sunset,
    sunrise: data.daily.sunrise[0],
  };
}
