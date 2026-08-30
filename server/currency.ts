import axios from 'axios';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  customEmojiId: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', customEmojiId: '5409048419211682843' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', customEmojiId: '5233326571099534068' },
  RUB: { code: 'RUB', name: 'Russian Ruble', symbol: '₽', customEmojiId: '5231449120635370684' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', customEmojiId: '5290017777174722330' },
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'RON', customEmojiId: '5854908544712707500' },
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', customEmojiId: '5404617696589390973' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', customEmojiId: '6113971389935391397' },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', customEmojiId: '5312441427764989435' }
};

// Fallback live market exchange rates relative to 1 USD
let cachedRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  RUB: 91.50,
  GBP: 0.79,
  RON: 4.58,
  LKR: 305.50,
  INR: 83.20,
  PKR: 278.40
};

let lastFetchTime = 0;

export async function fetchLiveExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  // Refetch every 15 minutes
  if (now - lastFetchTime < 15 * 60 * 1000 && lastFetchTime > 0) {
    return cachedRates;
  }

  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    if (res.data?.rates) {
      const liveRates = res.data.rates;
      cachedRates = {
        USD: 1.0,
        EUR: liveRates.EUR || cachedRates.EUR,
        RUB: liveRates.RUB || cachedRates.RUB,
        GBP: liveRates.GBP || cachedRates.GBP,
        RON: liveRates.RON || cachedRates.RON,
        LKR: liveRates.LKR || cachedRates.LKR,
        INR: liveRates.INR || cachedRates.INR,
        PKR: liveRates.PKR || cachedRates.PKR
      };
      lastFetchTime = now;
      console.log('[CURRENCY ENGINE] Updated live exchange rates from market:', cachedRates);
    }
  } catch (err: any) {
    console.warn('[CURRENCY ENGINE] Live exchange rate API fetch failed, using cached fallback rates:', err.message);
  }

  return cachedRates;
}

export function getCachedRates(): Record<string, number> {
  return cachedRates;
}

export function formatPriceInCurrency(amountUSD: number, currencyCode: string = 'USD'): { formatted: string; amountInCurr: number; symbol: string } {
  const curr = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.USD;
  const rate = cachedRates[curr.code] || 1.0;
  const amountInCurr = amountUSD * rate;

  let formatted = '';
  if (curr.code === 'USD') {
    formatted = `$${amountUSD.toFixed(2)}`;
  } else if (curr.code === 'EUR') {
    formatted = `€${amountInCurr.toFixed(2)}`;
  } else if (curr.code === 'RUB') {
    formatted = `${amountInCurr.toFixed(2)} ₽`;
  } else if (curr.code === 'GBP') {
    formatted = `£${amountInCurr.toFixed(2)}`;
  } else if (curr.code === 'INR') {
    formatted = `₹${amountInCurr.toFixed(2)}`;
  } else if (curr.code === 'LKR' || curr.code === 'PKR' || curr.code === 'RON') {
    formatted = `${amountInCurr.toFixed(2)} ${curr.code}`;
  } else {
    formatted = `${amountInCurr.toFixed(2)} ${curr.code}`;
  }

  return { formatted, amountInCurr, symbol: curr.symbol };
}
