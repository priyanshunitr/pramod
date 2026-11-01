-- JWTs are verified locally. Opaque sessions are no longer accepted after upgrade.
-- This removes only obsolete login sessions; accounts and hotel data are unchanged.
DROP TABLE sessions;
