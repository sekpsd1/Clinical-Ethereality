# Isolated Zoom Client View

This sub-app keeps the Zoom Meeting SDK 6.2.0 in its supported React 18.2.0 runtime. The main Clinical Ethereality application remains on Next.js 15 and React 19.

## Local verification

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run build
```

The build writes the disposable static bundle to `../public/zoom-sdk`. That output is ignored by git. It contains no consultation identifier, signature, host token, password, or credential value. At runtime, the iframe requests join data only after a user presses Join through the same-origin, session- and role-guarded route.

## Deployment gate

Do not deploy this sub-app until a separate approval explicitly covers: installing this lockfile on the deployment host, building the static bundle, publishing `public/zoom-sdk`, and validating Zoom's required CSP/browser behavior. The Zoom SDK bundle uses `eval`; follow Zoom's official CSP guidance rather than widening CSP beyond what Zoom requires.

## Rollback

No database, Plesk, Zoom Marketplace, or environment change is part of this sub-app. A future deployment rollback is limited to reverting the iframe launcher and removing the generated `public/zoom-sdk` artifact from that release. Audit history and consultation data are unaffected.
