/**
 * Admin configuration for Coursia.
 * Users in the ADMIN_EMAILS list bypass ALL payment walls and generation limits.
 * This is used for the founder/team to generate unlimited courses.
 */

export const ADMIN_EMAILS: string[] = [
  "chrisnsumbuk@gmail.com",
];

export const DAILY_LIMIT_ADMIN = 9999;

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
