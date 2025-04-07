# Portal

Portal is an always-on WebRTC-based peer-to-peer video tool for intra-office communication. All communication is encrypted, decentralized and peer-to-peer, except for the initial signaling which must be done through a central server because of the limitations of WebRTC.

## Features

- Always-on - A connection will always be re-established if it is lost
- Real-time peer-to-peer communication using WebRTC
- Zero-configuration - No need to join a room or wait for an invite
- Efficient signaling through Cloudflare Workers
- Simple and lightweight implementation
- Ring button to get the attention of a muted participant
- Morse code button to send a message to a participant

## Architecture

The project consists of two main components:

1. **Backend (Cloudflare Worker)**

   - Extremely minimal - No user authentication, no user accounts, no user profiles
   - Handles WebSocket connections for signaling
   - Manages room state using Cloudflare KV

2. **Frontend**

   - Zero-configuration - No need to join a room or wait for an invite
   - Simplified interface
   - Sound effects

## Technical Details

- Built on Cloudflare Workers platform
- Uses WebSocket for signaling
- Implements WebRTC for peer-to-peer communication
- Stores room state in Cloudflare KV
- Supports automatic role assignment (offerer/answerer)
- Handles connection cleanup and room management

## Getting Started

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js and npm

### Installation

1. Clone the repository:

   ```bash
   git clone [repository-url]
   cd portal
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your Cloudflare Workers project:

   - Update `wrangler.toml` with your Cloudflare account details
   - Set up a KV namespace named `PORTAL_KV`

4. Deploy to Cloudflare Workers:
   ```bash
   wrangler deploy
   ```

## Usage

1. Access the application through your deployed worker URL
2. The first user to join becomes the offerer
3. Subsequent users become answerers
4. WebRTC connection is established automatically
5. Audio/video communication begins once the connection is established

## Development

### Local Development

To run the project locally:

```bash
wrangler dev
```

### Testing

The application can be tested by:

1. Opening multiple browser windows
2. Connecting to the same room
3. Verifying audio/video communication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
