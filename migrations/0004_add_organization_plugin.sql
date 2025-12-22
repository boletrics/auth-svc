-- Migration number: 0004 	 2025-12-22T00:00:00.000Z
-- Better Auth organization plugin storage.
-- Uses plural table names with schema mapping in Better Auth config.

-- Add session "active organization" pointer used by the organization plugin.
ALTER TABLE sessions ADD COLUMN activeOrganizationId TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_activeOrganizationId ON sessions(activeOrganizationId);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo TEXT,
    metadata TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Members table (user <-> organization)
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY NOT NULL,
    organizationId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (organizationId, userId)
);

CREATE INDEX IF NOT EXISTS idx_members_organizationId ON members(organizationId);
CREATE INDEX IF NOT EXISTS idx_members_userId ON members(userId);

-- Invitations table (email-based onboarding)
CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY NOT NULL,
    organizationId TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inviterId TEXT NOT NULL,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (inviterId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitations_organizationId ON invitations(organizationId);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_inviterId ON invitations(inviterId);
