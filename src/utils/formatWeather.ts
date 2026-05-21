// WMO weather codes -> русское описание и emoji
// https://open-meteo.com/en/docs

export interface WeatherDescription {
  label: string;
  emoji: string;
}

const TABLE: Record<number, WeatherDescription> = {
  0: { label: 'Ясно', emoji: '☀️' },
  1: { label: 'В основном ясно', emoji: '🌤️' },
  2: { label: 'Переменная облачность', emoji: '⛅' },
  3: { label: 'Пасмурно', emoji: '☁️' },
  45: { label: 'Туман', emoji: '🌫️' },
  48: { label: 'Изморозь', emoji: '🌫️' },
  51: { label: 'Лёгкая морось', emoji: '🌦️' },
  53: { label: 'Морось', emoji: '🌦️' },
  55: { label: 'Сильная морось', emoji: '🌦️' },
  56: { label: 'Ледяная морось', emoji: '🌧️' },
  57: { label: 'Сильная ледяная морось', emoji: '🌧️' },
  61: { label: 'Небольшой дождь', emoji: '🌧️' },
  63: { label: 'Дождь', emoji: '🌧️' },
  65: { label: 'Сильный дождь', emoji: '🌧️' },
  66: { label: 'Ледяной дождь', emoji: '🌧️' },
  67: { label: 'Сильный ледяной дождь', emoji: '🌧️' },
  71: { label: 'Небольшой снег', emoji: '🌨️' },
  73: { label: 'Снег', emoji: '🌨️' },
  75: { label: 'Сильный снег', emoji: '❄️' },
  77: { label: 'Снежные зёрна', emoji: '❄️' },
  80: { label: 'Ливень', emoji: '🌧️' },
  81: { label: 'Сильный ливень', emoji: '⛈️' },
  82: { label: 'Очень сильный ливень', emoji: '⛈️' },
  85: { label: 'Снежный ливень', emoji: '🌨️' },
  86: { label: 'Сильный снежный ливень', emoji: '❄️' },
  95: { label: 'Гроза', emoji: '⛈️' },
  96: { label: 'Гроза с градом', emoji: '⛈️' },
  99: { label: 'Сильная гроза с градом', emoji: '⛈️' },
};

export function describeWeather(code: number): WeatherDescription {
  return TABLE[code] ?? { label: 'Неизвестно', emoji: '🌡️' };
}

export function formatTemp(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
}
