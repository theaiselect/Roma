// Qué archivos acepta el servidor. Compartido por la función de Vercel y el servidor de pruebas.
export const MAX_BLOB_BYTES = 4 * 1024 * 1024; // límite de cuerpo de las funciones de Vercel: 4,5 MB
export const BLOB_ID_RE = /^[0-9a-f-]{36}$/i;
// Cualquier imagen (menos SVG, que puede llevar código), PDF, audio y binario genérico (archivos sin tipo).
const TYPES = /^(image\/(?!svg)[a-z0-9.+-]+|application\/(pdf|octet-stream)|audio\/[a-z0-9.+-]+)(;.*)?$/i;
export const blobTypeOk = (type: string): boolean => TYPES.test(type);
