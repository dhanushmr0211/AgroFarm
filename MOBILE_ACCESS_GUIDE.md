# 📱 Mobile Access Guide - Farmer Bidding Platform

## 🌐 How to Access Your Platform from Your Phone

### ✅ **Current Server Status:**
- **Backend**: Running on `http://10.0.3.119:5001`
- **Frontend**: Running on `http://10.0.3.119:3000`

### 📋 **Steps to Access from Phone:**

#### 1. **Connect to Same WiFi Network**
- Make sure your phone is connected to the same WiFi network as your computer
- Both devices must be on the same local network

#### 2. **Open on Phone Browser**
- Open any browser on your phone (Chrome, Safari, Firefox, etc.)
- Type this URL: **`http://10.0.3.119:3000`**
- Press Enter/Go

#### 3. **If It Doesn't Work - Troubleshooting:**

**Option A: Check Windows Firewall**
```powershell
# Run in PowerShell as Administrator
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**Option B: Temporarily Disable Windows Firewall**
- Go to Windows Settings → Update & Security → Windows Security → Firewall & network protection
- Temporarily turn off firewall for Private networks
- Try accessing from phone again
- Remember to turn firewall back on

**Option C: Alternative IP Addresses to Try**
If `10.0.3.119` doesn't work, try these:
- `http://192.168.1.XXX:3000` (check your router's IP range)
- `http://localhost:3000` (if using phone hotspot)

#### 4. **Find Your Computer's IP Address**
Run this in Command Prompt if you need to check:
```cmd
ipconfig | findstr IPv4
```

### 🔧 **Technical Details:**

#### **Frontend Configuration (Vite)**
- Server bound to `0.0.0.0:3000` (accessible from network)
- CORS enabled for local network IPs
- Proxy configured to backend at `localhost:5001`

#### **Backend Configuration (Node.js)**
- Server bound to `0.0.0.0:5001` (accessible from network)
- CORS allows regex patterns for local network IPs:
  - `192.168.x.x:3000`
  - `10.x.x.x:3000`
  - `172.16-31.x.x:3000`
- Socket.IO configured with CORS and multiple transports

### 📱 **What You'll See on Phone:**
- Full responsive design optimized for mobile
- Touch-friendly buttons and navigation
- All features available: login, registration, APMC schedule, bidding, wallet
- Real-time updates via Socket.IO

### 🚨 **Common Issues & Solutions:**

1. **"Site can't be reached"**
   - Check if both devices are on same WiFi
   - Verify IP address with `ipconfig`
   - Check Windows Firewall settings

2. **"Connection refused"**
   - Make sure both servers are running
   - Check if ports 3000 and 5001 are not blocked

3. **API calls failing**
   - Backend might not be accessible from network
   - Check CORS configuration
   - Verify backend is running on `0.0.0.0:5001`

### 💡 **Pro Tips:**
- Bookmark the URL on your phone for easy access
- Use Chrome on mobile for best compatibility
- For production, you'd use proper domain names instead of IP addresses
- The platform works offline-first with service worker caching

---

### 🎯 **Quick Test URL:**
**Open this on your phone: `http://10.0.3.119:3000`**

The platform should load and you can register/login as either a Farmer or Buyer to test all features!