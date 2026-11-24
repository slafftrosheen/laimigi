import { error, type RequestEvent } from '@sveltejs/kit';

/** SvelteKit protects form actions; JSON mutation routes also require a matching Origin. */
export function assertSameOrigin(event: RequestEvent): void {
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, { message: 'forbidden' });
}

export async function readBoundedForm(request: Request, maxBytes = 64_000): Promise<FormData> {
	const size = Number(request.headers.get('content-length') ?? '0');
	if (size > maxBytes) error(413, { message: 'request_too_large' });
	const reader = request.body?.getReader();
	if (!reader) return new FormData();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel();
				error(413, { message: 'request_too_large' });
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
	if (
		!contentType.startsWith('application/x-www-form-urlencoded') &&
		!contentType.startsWith('multipart/form-data')
	) {
		error(415, { message: 'invalid_input' });
	}
	return new Response(Buffer.concat(chunks), {
		headers: { 'content-type': contentType }
	}).formData();
}
