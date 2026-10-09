// Shared helpers for generating mobile onboarding material for a Headscale
// network. Used by both the admin Invite page and the self-service key page so
// a non-admin user joining from a phone gets the same smooth experience.

export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// buildMobileConfig produces an Apple configuration profile (.mobileconfig) that
// points the Tailscale iOS/iPadOS app at this Headscale control server and
// auto-joins with the embedded auth key. Installable without MDM; the app reads
// the managed config from the profile.
export function buildMobileConfig(serverURL: string, authKey: string): string {
  const payloadUUID = uuidv4();
  const profileUUID = uuidv4();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.tailscale.ipn</string>
      <key>PayloadIdentifier</key>
      <string>${payloadUUID}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>ServerURL</key>
      <string>${serverURL}</string>
      <key>AuthKey</key>
      <string>${authKey}</string>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>内网 VPN 接入</string>
  <key>PayloadIdentifier</key>
  <string>${profileUUID}</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
}

// buildAndroidConfig returns the managed-app configuration JSON that an Android
// MDM pushes to the Tailscale app (ServerURL + AuthKey). The same payload also
// works as a manual copy/paste for users without MDM.
export function buildAndroidConfig(serverURL: string, authKey: string): string {
  return JSON.stringify({ ServerURL: serverURL, AuthKey: authKey }, null, 2);
}
