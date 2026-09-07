# Isolated Zoom Client View

This sub-app keeps the Zoom Meeting SDK 6.2.0 in its supported React 18.2.0 runtime. The main Clinical Ethereality application remains on Next.js 15 and React 19.

## Local verification

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run build
```

The build writes the disposable static bundle to `../public/zoom-sdk`. That output is ignored by git and contains no consultation identifier, signature, host token, password, or credential value at build time. At runtime, LINE opens this client in an external browser with a two-minute one-time ticket in the URL fragment. The client exchanges the ticket for an HttpOnly API-scoped session, removes the fragment, verifies camera and microphone access, releases the temporary media tracks, and requests join data only after the user presses Join.

## Deployment gate

Do not deploy this sub-app until a separate approval explicitly covers: installing this lockfile on the deployment host, building the static bundle, publishing `public/zoom-sdk`, and validating Zoom's required CSP/browser behavior. The Zoom SDK bundle uses `eval`; follow Zoom's official CSP guidance rather than widening CSP beyond what Zoom requires.

## Rollback

No schema, migration, Plesk, Zoom Marketplace, or environment change is part of this sub-app. A future deployment rollback is limited to reverting the external launcher/API routes and removing the generated `public/zoom-sdk` artifact from that release. Existing attendance history and consultation data are unaffected.
