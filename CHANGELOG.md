# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-03-15 – 2026-03-30

### Added
- Voice chat with WebRTC (signaling, state, relay, call UI, device switching)
- Voice call buttons in friend list
- User status system (online/idle/dnd/invisible)

### Fixed
- Rate limiting using real client IP from Bun.serve

## [0.3.0] - 2026-03-15

### Added
- User profiles: avatar, banner, bio, pronouns, links
- Profile card popup (click avatar or right-click)
- Image crop/zoom modal for avatar and banner uploads (GIF support)
- Profile settings tab with two-column layout and live preview
- Signed avatar URLs in all API responses

### Fixed
- CORS origin in production
- Auth re-init after network errors

## [0.2.0] - 2026-03-14 – 2026-03-15

### Added
- Emoji/GIF/sticker picker with GIPHY integration
- Emoji reactions on DM messages with jumbo display (1-5 emojis)
- Message editing with typing indicators
- Message reply with quote reference
- Message deletion (for everyone / for me) with confirmation
- File and image upload for DM messages
- Per-chat message drafts
- @mention autocomplete with popup and keyboard navigation
- Per-user mention colors and @everyone for groups
- Group DMs: create, edit, add/kick members, system messages
- Unread DM notification icons in server sidebar
- Reports, blocks, and mutes
- Rate limiting on DM messages (5 per 5 seconds) with countdown UI
- Context menu, confirmation dialogs, new DM/group popup
- Deploy script with auto-migration on startup

### Fixed
- Security: XSS, input validation, auth, rate limiting, upload hardening
- Storage quota check before message INSERT
- Sidebar sorting, chat switching, broken images
- Real-time presence updates and stale online status

## [0.1.0] - 2026-03-14

### Added
- Initial Tulpo: self-hosted Discord alternative
- Hono backend with Bun native WebSocket
- SvelteKit SPA frontend with Tailwind CSS v4
- SQLite database with migrations
- Auth: Argon2id + pepper + session tokens + brute force protection
- Friend system with requests, notes, and real-time updates
- DM chat with unread badges and sidebar sorting
- Docker support with docker-compose
- Design system with neutral gray palette

[Unreleased]: https://github.com/leminkozey/tulpo/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/leminkozey/tulpo/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/leminkozey/tulpo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/leminkozey/tulpo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leminkozey/tulpo/releases/tag/v0.1.0
