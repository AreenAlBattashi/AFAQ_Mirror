export default function handler() {
  return Response.json(
    { public: true, platform: 'vercel', storage: 'vercel-blob' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
