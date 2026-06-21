Story: MFA Login Prompt
As a registered user,
I want to be prompted for a TOTP code after entering my password,
So that my account is protected by multi-factor authentication.

Acceptance Criteria:
- After successful email/password login, the system presents a 6-digit TOTP input.
- A valid TOTP code grants access to the dashboard.
- An invalid TOTP code shows an error: "Invalid authentication code."
- The TOTP code expires after 30 seconds.
- After 5 failed attempts within 10 minutes, the account is locked for 15 minutes.
- Compliance: SOC2-CC6.1, ISO27001-A.9.4.2

Story: Password Reset Flow
As a user who has forgotten my password,
I want to receive a secure reset link via email,
So that I can regain access to my account.

Acceptance Criteria:
- User clicks "Forgot Password" and enters their registered email.
- System sends a single-use reset link valid for 30 minutes.
- Clicking the link opens a form to set a new password.
- New password must meet complexity requirements (8+ chars, uppercase, number, symbol).
- After reset, all existing sessions are invalidated.
- Compliance: SOC2-CC6.1, OWASP-ASVS-V2
