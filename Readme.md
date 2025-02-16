# SnapStream

SnapStream is a backend application for a video streaming platform. It provides APIs for user authentication, video uploads, comments, likes, subscriptions, and more.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:

```sh
git clone https://github.com/your-username/snapstream.git
cd snapstream
```

2. Install dependencies:

```sh
npm install
```

3. Create a `.env` file in the root directory and add the following environment variables:

```env
PORT=8080
MONGO_URI=your_mongodb_uri
CORS_ORIGIN=*

ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d

AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_aws_bucket_name
```

## Configuration

The application uses the following configuration files:

- `.env`: Environment variables
- `.gitignore`: Files and directories to be ignored by Git
- `.prettierignore`: Files and directories to be ignored by Prettier
- `.prettierrc`: Prettier configuration

## Usage

To start the development server, run:

```sh
npm run dev
```

The server will start on the port specified in the `.env` file (default is `8080`).

## API Endpoints

### User Authentication
- `POST /api/v1/users/register` - Register a new user
- `POST /api/v1/users/login` - Login a user
- `POST /api/v1/users/logout` - Logout a user
- `POST /api/v1/users/refresh-token` - Refresh access token
- `POST /api/v1/users/change-password` - Change user password
- `GET /api/v1/users/current-user` - Get current user details
- `PATCH /api/v1/users/update-account` - Update user account details
- `POST /api/v1/users/updateAvatar` - Update user avatar
- `POST /api/v1/users/updateCoverImage` - Update user cover image
- `GET /api/v1/users/c/:username` - Get user channel profile
- `GET /api/v1/users/history` - Get user watch history

### Videos
- `GET /api/v1/videos/getAllVideos` - Get all videos
- `POST /api/v1/videos/publishVideo` - Publish a new video
- `GET /api/v1/videos/:videoId` - Get video by ID
- `DELETE /api/v1/videos/:videoId` - Delete a video
- `PATCH /api/v1/videos/:videoId` - Update a video
- `PATCH /api/v1/videos/toggle/publish/:videoId` - Toggle video publish status

### Comments
- `GET /api/v1/comments/:videoId` - Get comments for a video
- `POST /api/v1/comments/:videoId` - Add a comment to a video
- `DELETE /api/v1/comments/c/:commentId` - Delete a comment
- `PATCH /api/v1/comments/c/:commentId` - Update a comment

### Likes
- `POST /api/v1/likes/toggle/v/:videoId` - Toggle like on a video
- `POST /api/v1/likes/toggle/c/:commentId` - Toggle like on a comment
- `POST /api/v1/likes/toggle/t/:tweetId` - Toggle like on a tweet
- `GET /api/v1/likes/videos` - Get liked videos

### Subscriptions
- `POST /api/v1/subscriptions/c/:channelId` - Toggle subscription
- `GET /api/v1/subscriptions/c/:channelId` - Get subscribed channels
- `GET /api/v1/subscriptions/u/:subscriberId` - Get channel subscribers

### Playlists
- `POST /api/v1/playlist` - Create a new playlist
- `GET /api/v1/playlist/:playlistId` - Get playlist by ID
- `PATCH /api/v1/playlist/:playlistId` - Update a playlist
- `DELETE /api/v1/playlist/:playlistId` - Delete a playlist
- `PATCH /api/v1/playlist/add/:videoId/:playlistId` - Add video to playlist
- `PATCH /api/v1/playlist/remove/:videoId/:playlistId` - Remove video from playlist
- `GET /api/v1/playlist/user/:userId` - Get user playlists

### Healthcheck
- `GET /api/v1/healthcheck` - Healthcheck endpoint

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any changes.

## License

This project is licensed under the ISC License.

