export default function handler() {
  return Response.json({
    public: true,
    storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'unconfigured',
  });
}
