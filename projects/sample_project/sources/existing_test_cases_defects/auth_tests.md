TC-001: Verify successful login with valid credentials
Preconditions: User account exists with MFA enabled.
Steps:
1. POST /auth/login with valid email and password.
2. Receive session_token in response.
3. POST /auth/mfa/verify with valid TOTP code.
Expected: 200 OK, session cookie issued, redirect to dashboard.
Status: Pass
Type: Functional

TC-002: Verify login fails with wrong password
Preconditions: User account exists.
Steps:
1. POST /auth/login with valid email and wrong password.
Expected: 401 Unauthorized, no session_token issued.
Status: Pass
Type: Negative

DEF-101: TOTP validation allows expired codes
Severity: High
Description: The /auth/mfa/verify endpoint accepts TOTP codes that have
expired beyond the 30-second window. This violates the time-based
one-time password specification (RFC 6238).
Steps to reproduce:
1. Generate a TOTP code.
2. Wait 60 seconds.
3. Submit the expired code to /auth/mfa/verify.
Expected: 401 Unauthorized
Actual: 200 OK (session granted)
Resolution: Pending fix in Sprint 14
