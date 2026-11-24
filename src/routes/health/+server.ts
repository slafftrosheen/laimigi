import type { RequestHandler } from '@sveltejs/kit';
/** Liveness only: not proof of database/provider connectivity. */
export const GET: RequestHandler = () => Response.json({ status: 'ok', service: 'laimigi' });
