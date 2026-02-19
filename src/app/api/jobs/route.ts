import { NextRequest, NextResponse } from 'next/server';
import { getAllJobs, createJob, updateJob, deleteJob } from '@/lib/storage';

export async function GET() {
  try {
    const jobs = await getAllJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const job = await request.json();
    await createJob(job);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const job = await request.json();
    await updateJob(job);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}