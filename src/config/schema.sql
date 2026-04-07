-- ============================================
-- PARKING BOOKING SYSTEM - DATABASE SCHEMA
-- ============================================
-- 
-- AUTH SYSTEM:
--   Drivers & Sellers → Xaman wallet login (XRPL address)
--   Admin → JWT (email + password)
--
-- PAYMENT FLOW:
--   Driver signs payment in Xaman app → sends to Admin wallet
--   Admin keeps 20% → sends 80% to Seller wallet
-- ============================================


-- ============================================
-- TABLE 1: USERS
-- ============================================
-- In schema.sql, the users table becomes:

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'driver'
        CHECK (role IN ('driver', 'seller', 'admin')),
    
    -- Only wallet ADDRESS — no seed stored!
    -- Drivers/sellers: comes from Xaman login
    -- Admin: set in .env (not here)
    wallet_address VARCHAR(60),
    
    profile_image TEXT,
    kyc_session_id VARCHAR(255),
    kyc_status VARCHAR(50) DEFAULT 'unverified',
    auth_type VARCHAR(20) DEFAULT 'xaman',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE 2.5: KYB_Submissions
-- ============================================
CREATE TABLE IF NOT EXISTS kyb_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    entity_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    google_maps_link VARCHAR(500),
    spot_type VARCHAR(50) CHECK (spot_type IN ('garage', 'open', 'covered', 'driveway', 'underground')),
    document_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLE 2: SPOTS
-- ============================================
CREATE TABLE IF NOT EXISTS spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,

    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,

    vehicle_types TEXT[] DEFAULT ARRAY['Car'],
    prices_per_hour DECIMAL(10, 2)[] DEFAULT ARRAY[10.0],

    image_urls TEXT[],

    is_available BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,

    total_slots INTEGER DEFAULT 1,
    available_slots INTEGER DEFAULT 1,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 3: BOOKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_duration_hours DECIMAL(5, 2) NOT NULL,

    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    actual_duration_hours DECIMAL(5, 2),

    vehicle_type VARCHAR(50) DEFAULT 'Car',
    price_per_hour DECIMAL(10, 2) NOT NULL,

    expected_price_xrp DECIMAL(20, 6) NOT NULL,

    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    overtime_price_xrp DECIMAL(20, 6) DEFAULT 0,

    total_price_xrp DECIMAL(20, 6) NOT NULL,

    admin_fee_xrp DECIMAL(20, 6),
    seller_amount_xrp DECIMAL(20, 6),

    booking_status VARCHAR(20) DEFAULT 'pending'
        CHECK (booking_status IN (
            'pending', 'confirmed', 'active', 'completed', 'cancelled'
        )),

    payment_status VARCHAR(20) DEFAULT 'unpaid'
        CHECK (payment_status IN (
            'unpaid', 'processing', 'paid', 'split_completed', 'failed', 'refunded'
        )),

    vehicle_number VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- TABLE 4: TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

    tx_hash VARCHAR(128) UNIQUE,
    from_address VARCHAR(60) NOT NULL,
    to_address VARCHAR(60) NOT NULL,
    amount_xrp DECIMAL(20, 6) NOT NULL,
    amount_drops BIGINT NOT NULL,

    tx_type VARCHAR(30) NOT NULL
        CHECK (tx_type IN ('driver_to_admin', 'admin_to_seller')),

    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'validated', 'failed')),

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
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_spots_owner ON spots(owner_id);
CREATE INDEX IF NOT EXISTS idx_spots_available ON spots(is_available, is_approved);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_spot ON bookings(spot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_type ON bookings(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);