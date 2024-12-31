'use client';

import { useParams } from 'next/navigation';

export default function MatchDetail() {
  const params = useParams(); // Access dynamic route parameters
  const matchId = params.matchId; // Retrieve the matchId parameter

  if (!matchId) return <div>Loading...</div>;

  return <div>Details for match: {matchId}</div>;
}
