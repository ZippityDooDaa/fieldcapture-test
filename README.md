# FieldCapture - Phase 1

A Next.js 14 Progressive Web App (PWA) for field job capture. Designed for mobile use with offline capability.

## Features

- ✅ **Job Management** - Create jobs with client selection, track time with start/stop timer
- ✅ **Photo Capture** - Take multiple photos per job using device camera
- ✅ **Voice Notes** - Record audio notes via MediaRecorder API
- ✅ **Offline Storage** - Uses IndexedDB for local data persistence
- ✅ **PWA Support** - Installable on Android/iOS with offline capability
- 🔄 **Sync to Synology** - Queue-based sync (API stub ready for SFTP implementation)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Hook Form
- IndexedDB (via idb library)
- Service Worker for offline support

## Quick Start

### 1. Install Dependencies

```bash
cd /mnt/s/projects/fieldcapture/phase1-app
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Build for Production

```bash
npm run build
```

Static files will be output to the `dist/` folder.

## Deployment

### Option 1: Static Hosting (Recommended)

The app is configured for static export. After building:

```bash
# Copy dist folder to your web server
rsync -av dist/ user@your-server:/var/www/fieldcapture/

# Or using scp
scp -r dist/* user@your-server:/var/www/fieldcapture/
```

### Option 2: Docker

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

### Option 3: Local Network (Testing)

```bash
cd dist
npx serve -l 3000
```

## Accessing on Mobile

1. Make sure your phone and server are on the same network (or use Tailscale)
2. Open the app URL in Chrome/Safari on your phone
3. **Add to Home Screen**:
   - **Android Chrome**: Menu → Add to Home Screen
   - **iOS Safari**: Share → Add to Home Screen

## Configuring Sync to Synology

Edit `src/app/api/sync/route.ts` and configure your Synology details:

```typescript
// Option 1: Using SFTP (ssh2-sftp-client)
const Client = require('ssh2-sftp-client');
const sftp = new Client();
await sftp.connect({
  host: 'YOUR_SYNOLOGY_TAILSCALE_IP',
  port: 22,
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD',
});
await sftp.put(Buffer.from(JSON.stringify(payload)), '/path/to/fieldcapture/sync.json');
```

Or use WebDAV if available on your Synology.

## Testing Checklist for Tim

### Basic Functionality
- [ ] Open app in mobile browser
- [ ] Add to Home Screen works
- [ ] App opens in standalone mode (no browser chrome)

### Jobs
- [ ] Create new job with client dropdown
- [ ] Start timer, verify it counts up
- [ ] Stop timer, verify duration saved
- [ ] Reset timer works
- [ ] Job list shows all jobs
- [ ] Search/filter works

### Photos
- [ ] Camera access permission prompt appears
- [ ] Can take photo
- [ ] Photo appears in job detail
- [ ] Can add caption to photo
- [ ] Photo persists after app reload

### Voice Notes
- [ ] Microphone access permission prompt appears
- [ ] Can record voice note
- [ ] Recording shows elapsed time
- [ ] Can play back recorded note
- [ ] Can delete voice note

### Offline
- [ ] App works without internet (enable airplane mode)
- [ ] Data persists after browser refresh
- [ ] Unsynced badge shows correctly

### Sync
- [ ] Sync button triggers API call
- [ ] Check browser console for sync payload
- [ ] Marked as synced after successful sync

## Project Structure

```
phase1-app/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main app with views
│   │   ├── layout.tsx        # Root layout with PWA meta
│   │   └── api/              # API routes
│   ├── components/
│   │   ├── JobList.tsx       # Job list with search
│   │   ├── JobForm.tsx       # New job form
│   │   ├── Timer.tsx         # Start/stop timer
│   │   ├── Camera.tsx        # Photo capture
│   │   └── VoiceRecorder.tsx # Audio recording
│   ├── lib/
│   │   └── storage.ts        # IndexedDB operations
│   └── types/
│       └── index.ts          # TypeScript types
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker
│   └── icon-*.png            # App icons
└── README.md
```

## Next Steps / Phase 2

1. **Implement actual SFTP sync** to Synology
2. **Add job editing** capability
3. **Photo gallery** with zoom/preview
4. **Export data** as CSV/PDF
5. **Multiple users** support
6. **Background sync** when connection restored

## Troubleshooting

### Camera not working
- Ensure using HTTPS (required for getUserMedia)
- Check permissions in browser settings
- Use Chrome or Safari (Firefox may have issues)

### App not installing
- Check manifest.json is being served correctly
- Verify HTTPS is enabled
- Look for "Add to Home Screen" in browser menu

### Data not persisting
- Check IndexedDB is supported (all modern browsers)
- Check browser console for errors
- May need to clear site data and retry

## License

MIT - Built for Tim's field work needs.# Force rebuild Sat Feb 21 12:29:52 AM AEDT 2026
