# Native Messaging Specification

ScreenRecorder uses the Chromium Native Messaging protocol to connect the browser extension to the local native host.

## Protocol Mechanics

1. Communication uses standard input (`stdin`) and standard output (`stdout`).
2. Each message is serialized as JSON, UTF-8 encoded.
3. Each message is preceded by a 32-bit unsigned integer (in native byte order / little-endian on x86) specifying the length of the message.
4. Maximum message size is 1 MB (1,048,576 bytes).

## Host Registration (Windows)

The host manifest is registered in the Windows Registry:

```text
HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.screenrecorder.native
HKEY_CURRENT_USER\Software\Microsoft\Edge\NativeMessagingHosts\com.screenrecorder.native
```

The registry key contains a default string pointing to the JSON manifest:

```json
{
  "name": "com.screenrecorder.native",
  "description": "ScreenRecorder Native Host",
  "path": "C:\\Program Files\\ScreenRecorder\\native-host.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://<EXTENSION_ID>/"
  ]
}
```

## Security Model

- **No Shell Execution**: The native host strictly parses structured JSON messages and invokes binaries directly via argument arrays (`spawn(ffmpegPath, args)`).
- **Path Whitelisting**: Output paths are restricted to user videos/recordings folders or designated application directories.
- **Request Identification**: Every request includes a unique `requestId` to pair responses and prevent race conditions.
