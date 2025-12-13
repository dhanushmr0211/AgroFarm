# 🚜 AgroFarm - Smart Agriculture Bidding Platform

AgroFarm is a real-time auction platform connecting Farmers directly with Buyers (Retailers/Wholesalers), eliminating middlemen and ensuring fair pricing through transparent bidding. It features live auctions, secure wallet payments, APMC integration, and AI-powered price predictions.

![AgroFarm Banner](https://via.placeholder.com/1200x400?text=AgroFarm+Platform)

## ✨ Key Features

- **🔴 Live Bidding System**: Real-time auction rooms with live countdowns, bid updates, and "Accept & End" functionality for farmers.
- **👨‍🌾 Farmer Dashboard**:
  - List produce with details (Grade, Quantity, Base Price).
  - Manage incoming bids and accept the highest bid.
  - View AI-driven price predictions.
  - Track earnings and active auctions.
- **🛒 Buyer Dashboard**:
  - Browse upcoming and live auctions.
  - Place bids in real-time.
  - Secure wallet integration for transactions.
- **🏛️ APMC Integration**: System for booking slots at Agricultural Produce Market Committees (APMCs).
- **🤖 AI Price Prediction**: Integration with machine learning models to forecast produce prices.
- **💰 Secure Payments**: Wallet system and Razorpay integration for seamless financial transactions.
- **🌍 Multi-language Support**: Accessibility for diverse user bases.

## 🛠️ Technology Stack

- **Frontend**: React.js (Vite), Tailwind CSS, Socket.io-client, Lucide React
- **Backend**: Node.js, Express.js, Socket.io (Real-time), Cron Jobs (Automation)
- **Database**: PostgreSQL, Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **External Services**: Razorpay (Payments), Gemini/Custom ML Model (Price Prediction)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL installed and running
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/farmer-bidding-platform.git
cd farmer-bidding-platform
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Update .env with your Database credentials and Razorpay keys

# Run Database Migrations
npx prisma migrate dev --name init

# Start Backend Server
npm run dev
```

**Backend connects on port `5001` by default.**

### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env file
cp .env.example .env

# Start Frontend Server
npm run dev
```

**Frontend runs on `http://localhost:3000`**

### 4. Environment Variables

**Backend (`backend/.env`)**
```env
PORT=5001
DATABASE_URL="postgresql://user:password@localhost:5432/agrofarm?schema=public"
JWT_SECRET="your_jwt_secret"
RAZORPAY_KEY_ID="your_key"
RAZORPAY_KEY_SECRET="your_secret"
FRONTEND_URL="http://localhost:3000"
```

**Frontend (`frontend/.env`)**
```env
VITE_API_URL="http://localhost:5001/api"
VITE_SOCKET_URL="http://localhost:5001"
```

## 📖 Usage Guide

1.  **Register**: Sign up as a **Farmer** or **Buyer**.
2.  **Farmer Flow**:
    - Dashbboard -> Add New Produce.
    - Wait for auction start time.
    - Join "Live Session" to monitor bids.
    - Click "Accept Highest Bid" to close the deal instantly.
3.  **Buyer Flow**:
    - Dashboard -> View Live Auctions.
    - Join an active session.
    - Place bids (wallet balance required).
    - Win auctions and complete payment.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request.

## 📄 License

This project is licensed under the MIT License.
