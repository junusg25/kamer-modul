-- Create feedback table for user feedback and bug reports
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature', 'improvement', 'complaint', 'other')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    page_url TEXT,
    user_agent TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Add comments for documentation
COMMENT ON TABLE feedback IS 'User feedback and bug reports for the repair shop application';
COMMENT ON COLUMN feedback.user_id IS 'ID of the user who submitted the feedback';
COMMENT ON COLUMN feedback.message IS 'The feedback message content';
COMMENT ON COLUMN feedback.type IS 'Type of feedback: bug, feature, improvement, complaint, or other';
COMMENT ON COLUMN feedback.priority IS 'Priority level: low, medium, high, or urgent';
COMMENT ON COLUMN feedback.status IS 'Current status: open, in_progress, resolved, or closed';
COMMENT ON COLUMN feedback.page_url IS 'URL of the page where feedback was submitted';
COMMENT ON COLUMN feedback.user_agent IS 'User agent string for debugging';
COMMENT ON COLUMN feedback.admin_notes IS 'Admin notes and resolution details';
COMMENT ON COLUMN feedback.created_at IS 'When the feedback was created';
COMMENT ON COLUMN feedback.updated_at IS 'When the feedback was last updated';
COMMENT ON COLUMN feedback.resolved_at IS 'When the feedback was resolved';
