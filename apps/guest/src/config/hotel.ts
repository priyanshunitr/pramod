// Replace this illustrative identity and room presentation with the hotel's own content.
export const hotel = { name: 'Pramod', descriptor: 'A BOUTIQUE STAY', slug: 'demo-hotel', timezone: 'Asia/Kolkata', heroImage: '/images/hotel-pool.jpg' };

export function roomPresentation(name: string) {
  const collection: Record<string, { image: string; tag: string; bed: string; intro: string }> = {
    'Classic Room': { image: '/images/classic-room.jpg', tag: 'A LITTLE EVERYDAY LUXURY', bed: 'Double bed', intro: 'Soft light, a comfortable bed, and everything in its right place. A quiet corner to make your own.' },
    'Deluxe Room': { image: '/images/deluxe-room.jpg', tag: 'MORE SPACE, MORE SLOW', bed: 'King bed', intro: 'Room to stretch out and settle in. Thoughtful details make unhurried mornings feel even better.' },
    'Family Suite': { image: '/images/family-suite.jpg', tag: 'BETTER TOGETHER', bed: 'Family sleeping arrangement', intro: 'A welcoming base for shared adventures, long conversations, and a little well-earned rest.' },
  };
  return collection[name] ?? { image: '/images/classic-room.jpg', tag: 'MAKE YOURSELF AT HOME', bed: 'Ask about bed arrangements', intro: 'A welcoming place to settle in for your stay.' };
}

export const formatMoney = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
