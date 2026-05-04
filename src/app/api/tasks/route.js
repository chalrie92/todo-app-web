import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

let redis = null;
try {
  // UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  }
} catch (e) {
  console.warn("Redis initialization failed.");
}

// 로컬 환경 테스트용 임시 메모리 저장소 (Vercel DB가 연결되기 전까지 작동)
let localTasks = [];

export async function GET() {
  try {
    if (redis) {
      const tasks = await redis.get('global_tasks') || [];
      return NextResponse.json(tasks);
    }
    return NextResponse.json(localTasks);
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const tasks = await request.json();
    if (redis) {
      await redis.set('global_tasks', tasks);
    } else {
      localTasks = tasks;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: "Failed to save tasks" }, { status: 500 });
  }
}
