// Datos privados del viaje. Este archivo solo se ejecuta en el servidor (Vercel): nunca llega al navegador
// ni a la app que se descarga. La app los recibe por /api/private, y solo con el código del viaje.
export const privateData = {
  hotel: { bookingSite: 'Booking.com', bookingRef: '5044007987', pin: '5702' },
};
export type PrivateData = typeof privateData;
