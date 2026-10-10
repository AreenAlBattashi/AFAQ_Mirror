import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const expectedKey = process.env.BOOTH_UPLOAD_KEY;
        if (!expectedKey) throw new Error('BOOTH_UPLOAD_KEY is not configured');

        let suppliedKey = '';
        try {
          suppliedKey = JSON.parse(clientPayload || '{}').key || '';
        } catch {
          throw new Error('Invalid booth credentials');
        }
        if (suppliedKey !== expectedKey) throw new Error('Invalid booth upload key');

        return {
          allowedContentTypes: ['image/jpeg'],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: '{}',
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 400 });
  }
}
