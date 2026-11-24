import { requireRole } from '#lib/server/auth';
import { assertSameOrigin } from '#lib/server/http';
import { draftInstructions, runAiRequest } from '#lib/server/ai/service';
import { safeAiError } from '#lib/server/ai/types';
import { readDraftRequest } from '#lib/server/ai/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	assertSameOrigin(event);
	const { user } = await requireRole(event, ['teacher', 'admin', 'root_admin']);
	try {
		const input = await readDraftRequest(event.request);
		const result = await runAiRequest({
			userId: user.id,
			provider: input.provider,
			prompt: input.prompt,
			instructions: draftInstructions(input),
			signal: event.request.signal
		});
		return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		const safe = safeAiError(error);
		return Response.json(
			{ error: safe.code },
			{ status: safe.status, headers: { 'Cache-Control': 'no-store' } }
		);
	}
};
