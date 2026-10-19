// Vercel llama a la variable <PREFIJO>_READ_WRITE_TOKEN según el nombre que se le dé al almacén.
// Aceptamos cualquiera, para que funcione aunque el prefijo no sea el de por defecto (BLOB).
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN;
  if (direct) return direct;
  const k = Object.keys(process.env).find((n) => n.endsWith('READ_WRITE_TOKEN') && process.env[n]);
  return k ? process.env[k] : undefined;
}
