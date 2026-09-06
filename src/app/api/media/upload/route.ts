import { NextResponse } from 'next/server';

// Retired endpoint: Media uploads now use direct Cloudinary signed uploads via /api/uploads/signature
export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint retired: Media uploads now use direct Cloudinary signed uploads via /api/uploads/signature',
    },
    { status: 410 }
  );
}
