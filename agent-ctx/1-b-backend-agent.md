# Task 1-b: Backend API Routes

## Completed
All 8 API routes created successfully:

1. **`/api/users/search`** (GET) - Search users by firstName/lastName/email, max 10, excludes requesting user
2. **`/api/courses/[id]/share`** (POST) - Share course, validates ownership + recipient, prevents duplicates
3. **`/api/courses/shared`** (GET) - List shared courses for a user, marks as read, includes sharer name
4. **`/api/courses/[id]/publish`** (POST) - Publish/unpublish via PublicCourse create/delete
5. **`/api/courses/open`** (GET) - Public endpoint, lists published courses with view increment
6. **`/api/certificates`** (GET) - List user's certificates
7. **`/api/certificates/generate`** (POST) - Generate certificate on course completion, unique CRS-XXXX ID
8. **`/api/certificates/[id]`** (GET) - Get single certificate (public verification link)

## Files Created
- `src/app/api/users/search/route.ts`
- `src/app/api/courses/[id]/share/route.ts`
- `src/app/api/courses/shared/route.ts`
- `src/app/api/courses/[id]/publish/route.ts`
- `src/app/api/courses/open/route.ts`
- `src/app/api/certificates/route.ts`
- `src/app/api/certificates/generate/route.ts`
- `src/app/api/certificates/[id]/route.ts`

## Notes
- All lint checks pass (zero new errors)
- Uses `getUserIdFromRequest` for auth from Authorization header
- Follows existing project patterns (NextRequest/NextResponse, try/catch, console.error)
- No unique compound constraint on CourseShare (used `findFirst` instead of `findUnique`)
