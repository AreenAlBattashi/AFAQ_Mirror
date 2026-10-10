# Jahiziya 360 AI Photo Booth

Full-screen React/TypeScript event photo booth for **ملتقى نحو الواقع المهني 2026 — جاهزية 360**.

## Setup

Requires Node.js 20.19+ and internet access on first use to load the MediaPipe model and WASM files.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on the booth computer. Allow camera access, then use the full-screen button. For a production build:

```bash
npm run build
npm start
```

Set `PORT` to change the default port 5173. Run the server on a machine reachable by visitors' phones on the same Wi-Fi network. By default, the QR code uses the computer's first LAN IPv4 address, even when the kiosk opens `localhost`. Set `PUBLIC_BASE_URL` to a reachable HTTPS URL if needed, especially on a computer with multiple network adapters. Allow this port through the computer firewall. Browsers normally require HTTPS for camera access at a non-localhost address, so the kiosk can use `localhost` or a trusted HTTPS reverse proxy.

### QR codes that work on any network

A QR code is only a link. A photo on a local computer cannot be downloaded from another network without a public server or tunnel. For a temporary event demo, [install `cloudflared`](https://developers.cloudflare.com/tunnel/downloads/), build the app, and run:

```powershell
npm.cmd run build
npm.cmd run public
```

Keep this terminal running. Wait until it prints `Public photo URL: https://...trycloudflare.com` before taking photos. The kiosk can still open `http://localhost:5173`, while QR codes point to the public HTTPS address. Phones on any network can then download the photo while the booth and tunnel remain online. Quick tunnels generate a new address on each restart and are intended for testing; for a real event, configure a stable hosted HTTPS address and set `PUBLIC_BASE_URL` to it before `npm.cmd start`. The public address exposes saved photos to anyone holding their unguessable link. Photos remain on this computer until deleted from `photos/`.

## Logos

The attachments were not available in this workspace. Replace `public/utas-logo.svg` and `public/techno-group-logo.svg` with the actual logo files, keeping these names (or update the paths in `src/main.tsx`). Both remain separate editable assets. The UTAS asset is displayed without filters or color changes. Replace the placeholders before the event.

## Experience

The visitor allows the camera and raises one hand for about one second to begin. The live mirror fills nearly the entire display; instructions and event information appear over the video inside a thin frame. A thumbs-up held steadily starts the 3–2–1 countdown and captures a framed photo. Raising both hands opens an information view over the mirror; a button returns to the camera. The result view shows a QR code, direct download, retake button, and resets after 30 seconds. If camera permission or AI loading fails, demo buttons walk through the experience.

MediaPipe Pose scans up to five people; the largest centered visible person is selected. Hand gestures must occur near that person's tracked wrists. This reduces background triggers, though crowded overlapping subjects or occlusion can still affect recognition. Place the camera close to the visitor and keep a clear foreground zone. Thumbs-up detection works best with a visible hand facing the camera.

Photos are stored in the local `photos/` directory and served by the included Node server. No account or personal details are requested. Remove photos from that directory according to your event retention policy.

## Deploying on Vercel

The Vercel deployment uses direct browser uploads to a **public Vercel Blob store**, so high-resolution photos do not pass through the Vercel Function body-size limit. QR codes point to the resulting Blob download URL. Anyone with a photo URL can access that photo until it is deleted from Blob storage.

1. Import this repository in Vercel using the Vite preset. Keep the root directory as `./`; the build command is `npm run build` and the output directory is `dist`.
2. After the project is created, open **Storage**, create a **Blob** store with **Public** access, and connect it to Production and Preview. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
3. In **Settings → Environment Variables**, add `BOOTH_UPLOAD_KEY` with a strong event-specific value for Production and Preview.
4. Redeploy the project. On each booth computer, open the HTTPS deployment and enter the upload key once when the first photo is taken. It is kept only in that browser tab's session storage.
5. Delete event photos from the Blob store after the agreed retention period.

Automatic local downloading still works on the booth computer. Local `npm run dev` continues to store QR photos in `photos/`; deployed Vercel builds store them in Blob.
