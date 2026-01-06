# DWITS Dashboard

Production-ready dashboard for team performance tracking with MongoDB integration.

## Features

- 📊 Real-time team performance metrics
- 🏆 Interactive leaderboard
- 💰 Clickable commission details with modal
- 🎨 GHL-inspired dark theme
- 📱 Fully responsive design
- ⚡ Fast and optimized

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
MONGODB_URI=your_mongodb_connection_string
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Production Build
```bash
npm run build
npm start
```

## Deploy to Vercel
```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to Vercel dashboard.

## Environment Variables

- `MONGODB_URI` - MongoDB connection string

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- MongoDB
- Lucide React Icons

## License

MIT