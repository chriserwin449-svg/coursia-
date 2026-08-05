/**
 * Admin configuration for Coursia.
 * Users in the ADMIN_EMAILS list bypass ALL payment walls and generation limits.
 * This is used for the founder/team to generate unlimited courses.
 */

export const ADMIN_EMAILS: string[] = [
  "chrisnsumbuk@gmail.com",
];

/** Admin users have NO daily limit — the check is skipped entirely for them */
export const DAILY_LIMIT_ADMIN = 0; // 0 = unlimited (check skipped in generate route)

/**
 * Check if a user email is an admin (bypasses all limits).
 * Case-insensitive comparison.
 */
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
  );
}
