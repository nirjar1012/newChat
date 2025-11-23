-- Friend Requests Table
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    receiver_email TEXT NOT NULL,
    receiver_id TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friends Table
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    user2_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_friendship UNIQUE(user1_id, user2_id),
    CONSTRAINT no_self_friendship CHECK (user1_id != user2_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_email ON friend_requests(receiver_email);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_friends_user1 ON friends(user1_id);
CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user2_id);

-- Function to ensure friendship is stored in consistent order
CREATE OR REPLACE FUNCTION insert_friendship()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure user1_id is always less than user2_id for consistency
    IF NEW.user1_id > NEW.user2_id THEN
        DECLARE temp TEXT;
        BEGIN
            temp := NEW.user1_id;
            NEW.user1_id := NEW.user2_id;
            NEW.user2_id := temp;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain friendship order
DROP TRIGGER IF EXISTS ensure_friendship_order ON friends;
CREATE TRIGGER ensure_friendship_order
    BEFORE INSERT ON friends
    FOR EACH ROW
    EXECUTE FUNCTION insert_friendship();
