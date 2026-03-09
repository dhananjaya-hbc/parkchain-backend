-- ============================================
-- PARKING BOOKING SYSTEM - DATABASE SCHEMA
-- ============================================
-- 
-- AUTH SYSTEM NOTES:
--   Drivers & Sellers → Web3Auth (social login, wallet auto-generated)
--   Admin → JWT (email + password, only 1 super admin)
--
-- PAYMENT FLOW:
--   Driver pays full amount → Admin XRPL wallet
--   Admin keeps 20% → sends 80% to Seller wallet
-- ============================================


-- ============================================
-- TABLE 1: USERS
-- ============================================
-- Stores ALL users in one table (driver, seller, admin)
--
-- WHY one table?
--   If we had 3 separate tables (drivers, sellers, admins),
--   every time we check "who made this request?", we'd have to
--   search 3 tables. One table = one search = simpler code.
--
-- AUTH DIFFERENCE:
--   - driver/seller: authenticated via Web3Auth (NO password)
--     → Web3Auth gives us their wallet address, email, name
--     → password column will be NULL for them
--   - admin: authenticated via email + password (JWT)
--     → password column will have a bcrypt hash

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info (comes from Web3Auth for drivers/sellers)
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Password: ONLY used by admin (JWT auth)
    -- NULL for drivers/sellers (they use Web3Auth)
    password VARCHAR(255),

    -- Role determines permissions
    role VARCHAR(20) NOT NULL DEFAULT 'driver'
        CHECK (role IN ('driver', 'seller', 'admin')),

    -- Web3Auth fields (for drivers and sellers)
    -- web3auth_sub: unique identifier from Web3Auth (like a user ID from Google)
    -- Example: "google|1234567890" or "email|abc@gmail.com"
    web3auth_sub VARCHAR(255) UNIQUE,

    -- XRPL Wallet (comes from Web3Auth for drivers/sellers)
    -- For admin: set manually in .env (not stored here)
    wallet_address VARCHAR(60),
    wallet_seed VARCHAR(100),     


    -- Profile image from social login
    profile_image TEXT,

    -- Seller verification: admin must verify before seller can list spots
    is_verified BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 2: SPOTS
-- ============================================
-- Parking spots listed by sellers
--
-- is_available logic:
--   true  → drivers can see and book this spot
--   false → spot is full or seller deactivated it
--
-- is_approved logic:
--   true  → admin has approved this spot listing
--   false → waiting for admin approval (drivers can't see it yet)
--
-- A spot is ONLY shown to drivers when:
--   is_available = true AND is_approved = true AND available_slots > 0

CREATE TABLE IF NOT EXISTS spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who listed this spot? Must be a seller.
    -- REFERENCES users(id) = this MUST match an existing user
    -- ON DELETE CASCADE = if seller account deleted, their spots go too
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Spot details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,

    -- GPS coordinates (for showing on map)
    -- DECIMAL(10,8) gives precision to ~1.1mm (more than enough!)
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,

    -- Pricing
    price_per_hour DECIMAL(10, 2) NOT NULL,  -- e.g., 5.00 XRP per hour

    -- Images
    image_urls TEXT[],   -- PostgreSQL array: ['url1', 'url2', 'url3']

    -- Availability
    -- is_available: seller can toggle this ON/OFF
    -- When all slots are booked, we auto-set this to false
    is_available BOOLEAN DEFAULT true,

    -- Admin must approve spot before it appears to drivers
    is_approved BOOLEAN DEFAULT false,

    -- Slot management
    -- Example: a parking lot might have 20 total slots
    -- When someone books, available_slots decreases by 1
    -- When booking ends, available_slots increases by 1
    total_slots INTEGER DEFAULT 1,
    available_slots INTEGER DEFAULT 1,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 3: BOOKINGS
-- ============================================
-- Core table: connects drivers, spots, and payments
--
-- DURATION LOGIC:
--   When driver books:
--     → start_time & end_time are set (planned times)
--     → expected_duration_hours is calculated
--     → expected_price_xrp is calculated
--
--   When driver checks out:
--     → actual_end_time is recorded
--     → actual_duration_hours is calculated
--     → If actual > expected, overtime is charged
--     → total_price_xrp = final amount to pay

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- WHO booked (driver)
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- WHICH spot
    spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    -- WHO owns the spot (seller) — stored here for easy queries
    -- Without this, we'd need to JOIN spots→users every time
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- ====== PLANNED/EXPECTED TIMES ======
    -- Set when driver creates the booking
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    -- How long the driver PLANS to stay
    expected_duration_hours DECIMAL(5, 2) NOT NULL,

    -- ====== ACTUAL TIMES ======
    -- Set when driver actually checks in/out
    -- NULL until driver arrives / leaves
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    -- How long the driver ACTUALLY stayed (filled on checkout)
    actual_duration_hours DECIMAL(5, 2),

    -- ====== PRICING ======
    price_per_hour DECIMAL(10, 2) NOT NULL,

    -- Price for the expected/booked duration
    -- expected_price = expected_duration_hours × price_per_hour
    expected_price_xrp DECIMAL(20, 6) NOT NULL,

    -- Extra charge if driver stays beyond booked time
    -- overtime_hours = actual_duration - expected_duration (if positive)
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    overtime_price_xrp DECIMAL(20, 6) DEFAULT 0,

    -- FINAL total price (expected_price + overtime_price)
    -- This is what the driver actually pays
    total_price_xrp DECIMAL(20, 6) NOT NULL,

    -- ====== PAYMENT SPLIT ======
    -- Calculated from total_price_xrp
    -- admin_fee = total_price × 20%
    -- seller_amount = total_price × 80%
    admin_fee_xrp DECIMAL(20, 6),
    seller_amount_xrp DECIMAL(20, 6),

    -- ====== STATUS TRACKING ======
    booking_status VARCHAR(20) DEFAULT 'pending'
        CHECK (booking_status IN (
            'pending',      -- Just created, waiting for payment
            'confirmed',    -- Payment received, waiting for start time
            'active',       -- Driver has checked in, currently parked
            'completed',    -- Driver checked out, booking finished
            'cancelled'     -- Booking was cancelled
        )),

    payment_status VARCHAR(20) DEFAULT 'unpaid'
        CHECK (payment_status IN (
            'unpaid',           -- No payment yet
            'processing',       -- XRPL transaction in progress
            'paid',             -- Driver → Admin payment confirmed
            'split_completed',  -- Admin → Seller (80%) payment done
            'failed',           -- Transaction failed on XRPL
            'refunded'          -- Money returned to driver
        )),

    vehicle_number VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 4: TRANSACTIONS
-- ============================================
-- Every XRPL blockchain transaction is recorded here
--
-- For each booking, there are TWO transactions:
--   1. driver_to_admin  → Driver sends FULL amount to admin wallet
--   2. admin_to_seller  → Admin sends 80% to seller wallet
--
-- tx_hash is the PROOF that this transaction happened on the blockchain
-- Anyone can verify it at: https://testnet.xrpl.org/transactions/{tx_hash}

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

    -- XRPL blockchain data
    tx_hash VARCHAR(128) UNIQUE,
    from_address VARCHAR(60) NOT NULL,
    to_address VARCHAR(60) NOT NULL,
    amount_xrp DECIMAL(20, 6) NOT NULL,
    -- 1 XRP = 1,000,000 drops (like 1 dollar = 100 cents, but more precise)
    amount_drops BIGINT NOT NULL,

    tx_type VARCHAR(30) NOT NULL
        CHECK (tx_type IN (
            'driver_to_admin',
            'admin_to_seller'
        )),

    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'submitted',
            'validated',
            'failed'
        )),

    ledger_index BIGINT,
    result_code VARCHAR(50),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 5: REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    spot_id UUID REFERENCES spots(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- INDEXES (for faster queries)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_web3auth ON users(web3auth_sub);
CREATE INDEX IF NOT EXISTS idx_spots_owner ON spots(owner_id);
CREATE INDEX IF NOT EXISTS idx_spots_available ON spots(is_available, is_approved);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_spot ON bookings(spot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);


-- ============================================
-- SEED: Create the super admin account
-- ============================================
-- Only runs if no admin exists yet
-- Password will be set via a separate script (Step 4)

-- We don't insert admin here because password needs to be hashed
-- We'll do it in the seed script