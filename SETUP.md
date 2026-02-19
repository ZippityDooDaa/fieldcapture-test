# FieldCapture - Setup Instructions

## Quick Start

```bash
cd /mnt/s/projects/fieldcapture/phase1-app

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000 in your browser
```

## Build for Production

```bash
# Build static export
npm run build

# Output will be in dist/ folder
# Deploy dist/ to any static web server
```

## Deployment Options

### 1. Local Testing
```bash
cd dist
npx serve -l 3000
```

### 2. Copy to Server
```bash
# Using rsync
rsync -av dist/ user@your-server:/var/www/fieldcapture/

# Or using scp
scp -r dist/* user@your-server:/var/www/fieldcapture/
```

### 3. Synology NAS
1. Enable Web Station in DSM
2. Create a virtual host pointing to the dist folder
3. Access via your Tailscale IP

## Mobile Setup

1. Make sure your phone and server are on the same network
2. Open the app URL in Chrome (Android) or Safari (iOS)
3. Add to Home Screen:
   - **Android**: Menu → Add to Home Screen
   - **iOS**: Share → Add to Home Screen

## Sync Configuration

Edit `src/app/api/sync/route.ts` and add your Synology SFTP details:

```typescript
// Install: npm install ssh2-sftp-client
import Client from 'ssh2-sftp-client';

const sftp = new Client();
await sftp.connect({
  host: 'YOUR_TAILSCALE_IP',
  username: 'YOUR_USER',
  password: 'YOUR_PASS',
});
await sftp.put(
  Buffer.from(JSON.stringify(payload)),
  '/volume1/fieldcapture/jobs.json'
);
```

## Project Files Created

```
phase1-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main app (list/form/detail views)
│   │   ├── layout.tsx            # Root layout with PWA setup
│   │   ├── globals.css           # Tailwind imports
│   │   └── api/
│   │       ├── jobs/route.ts     # Job CRUD API
│   │       ├── clients/route.ts  # Client API
│   │       └── sync/route.ts     # Sync to Synology stub
│   ├── components/
│   │   ├── JobList.tsx           # Job list with search/filter
│   │   ├── JobForm.tsx           # Create job form
│   │   ├── Timer.tsx             # Start/stop timer
│   │   ├── Camera.tsx            # Photo capture via getUserMedia
│   │   └── VoiceRecorder.tsx     # Audio recording via MediaRecorder
│   ├── lib/
│   │   └── storage.ts            # IndexedDB operations
│   └── types/
│       └── index.ts              # TypeScript types
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   └── icon-*.png.svg            # App icons (SVG placeholders)
├── package.json                  # Dependencies
├── next.config.js                # Static export config
├── tailwind.config.js            # Tailwind config
├── postcss.config.js             # PostCSS config
├── tsconfig.json                 # TypeScript config
└── README.md                     # Full documentation
```

## Features Implemented

✅ Job Management - Create jobs with client dropdown
✅ Timer - Start/stop tracking with duration calculation
✅ Photo Capture - Camera access via getUserMedia API
✅ Voice Notes - Audio recording via MediaRecorder API
✅ Local Storage - IndexedDB for offline persistence
✅ PWA Support - Installable, works offline
✅ Sync Queue - Basic sync API (needs SFTP implementation)

## Next Steps

1. Replace SVG icons with real PNG files
2. Configure Synology SFTP credentials in sync route
3. Add more clients to the seed data
4. Test on actual mobile device
5. Add background sync for offline support

## Known Issues

- Icons are SVG placeholders - replace with real PNG files for production
- Sync currently just logs to console - implement actual SFTP upload
- Camera requires HTTPS in production (works on localhost for testing)