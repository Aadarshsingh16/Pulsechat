import { NextRequest, NextResponse } from 'next/server';

export const CURATED_GIFS = [
  { id: '1', title: 'Celebration Confetti', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', previewUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif' },
  { id: '2', title: 'Thumbs Up Approval', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif' },
  { id: '3', title: 'Happy Cat Wave', url: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif', previewUrl: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/200w.gif' },
  { id: '4', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif' },
  { id: '5', title: 'Coding Hacker Fast', url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', previewUrl: 'https://media.giphy.com/media/unQ3IJU2RG7DO/200w.gif' },
  { id: '6', title: 'Applause Bravo', url: 'https://media.giphy.com/media/l4q8cJzGdR9J8w3hS/giphy.gif', previewUrl: 'https://media.giphy.com/media/l4q8cJzGdR9J8w3hS/200w.gif' },
  { id: '7', title: 'Popcorn Excited', url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif', previewUrl: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif' },
  { id: '8', title: 'Laughing Dog', url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', previewUrl: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/200w.gif' },
];

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').toLowerCase().trim();

  // No query: show curated defaults (fast, no API call, good empty-state UX)
  if (!query) {
    return NextResponse.json({ gifs: CURATED_GIFS });
  }

  // Query present + API key configured: real Giphy search
  if (GIPHY_API_KEY) {
    try {
      const giphyRes = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=24&rating=pg-13`
      );
      if (giphyRes.ok) {
        const data = await giphyRes.json();
        const gifs = (data.data || []).map((g: any) => ({
          id: g.id,
          title: g.title || 'GIF',
          url: g.images?.original?.url || g.images?.downsized?.url,
          previewUrl: g.images?.fixed_width_small?.url || g.images?.fixed_height_small?.url || g.images?.original?.url,
        })).filter((g: any) => g.url && g.previewUrl);
        return NextResponse.json({ gifs });
      }
    } catch (err) {
      console.error('Giphy API error, falling back to curated list:', err);
    }
  }

  // Fallback: filter curated list by title match (existing behavior)
  const filtered = CURATED_GIFS.filter((g) =>
    g.title.toLowerCase().includes(query)
  );
  return NextResponse.json({ gifs: filtered.length ? filtered : CURATED_GIFS.slice(0, 4) });
}
