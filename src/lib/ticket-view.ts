// Visor de entradas dentro de la app: quien quiere enseñar una entrada la «publica» aquí
// y el visor (montado una sola vez en la carcasa de la app) la muestra a pantalla completa.
// Se evita window.open: tras un `await` los móviles lo bloquean como ventana emergente.

export interface TicketRef {
  id: string;
  blobId: string;
  mime: string;
  name: string;
}

export interface TicketRequest { items: TicketRef[]; index: number }

const EVENT = 'roma-show-ticket';

export function showTicket(items: TicketRef[], index = 0): void {
  window.dispatchEvent(new CustomEvent<TicketRequest>(EVENT, { detail: { items, index: Math.max(0, Math.min(index, items.length - 1)) } }));
}

export function onShowTicket(fn: (r: TicketRequest) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<TicketRequest>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
