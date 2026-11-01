// Replace this illustrative identity and room presentation with the hotel's own content.
import { propertySlug } from '@hotel/api-client';
export const hotel = { name: 'Pramod', descriptor: 'A BOUTIQUE STAY', slug: propertySlug, timezone: 'Asia/Kolkata', heroImage: '/images/hotel-pool.jpg', lifeImage: '/images/pramod-night-retreat-v1.png' };

// Homepage content is maintained here, independently of bookable inventory.
// These illustrative starting rates are not booking quotes.
export const featuredRooms = [
  { slug: 'classic-room', name: 'Classic Room', maxGuests: 2, startingRateMinor: 450000, currency: 'INR', image: '/images/classic-room.jpg' },
  { slug: 'deluxe-room', name: 'Deluxe Room', maxGuests: 3, startingRateMinor: 650000, currency: 'INR', image: '/images/deluxe-room.jpg' },
  { slug: 'family-suite', name: 'Family Suite', maxGuests: 4, startingRateMinor: 950000, currency: 'INR', image: '/images/family-suite.jpg' },
] as const;

export function roomPresentation(name: string) {
  const collection: Record<string, { image: string; tag: string; bed: string; intro: string }> = {
    'Classic Room': { image: '/images/classic-room.jpg', tag: 'A LITTLE EVERYDAY LUXURY', bed: 'Double bed', intro: 'Soft light, a comfortable bed, and everything in its right place. A quiet corner to make your own.' },
    'Deluxe Room': { image: '/images/deluxe-room.jpg', tag: 'MORE SPACE, MORE SLOW', bed: 'King bed', intro: 'Room to stretch out and settle in. Thoughtful details make unhurried mornings feel even better.' },
    'Family Suite': { image: '/images/family-suite.jpg', tag: 'BETTER TOGETHER', bed: 'Family sleeping arrangement', intro: 'A welcoming base for shared adventures, long conversations, and a little well-earned rest.' },
  };
  return collection[name] ?? { image: '/images/classic-room.jpg', tag: 'MAKE YOURSELF AT HOME', bed: 'Ask about bed arrangements', intro: 'A welcoming place to settle in for your stay.' };
}

export const formatMoney = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
