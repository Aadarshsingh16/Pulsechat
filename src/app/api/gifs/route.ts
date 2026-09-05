import { NextRequest, NextResponse } from 'next/server';

const CURATED_GIFS = [
  { id: '1', title: 'Celebration Confetti', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', previewUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif' },
  { id: '2', title: 'Thumbs Up Approval', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif' },
  { id: '3', title: 'Happy Cat Wave', url: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif', previewUrl: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/200w.gif' },
  { id: '4', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif' },
  { id: '5', title: 'Coding Hacker Fast', url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', previewUrl: 'https://media.giphy.com/media/unQ3IJU2RG7DO/200w.gif' },
  { id: '6', title: 'Applause Bravo', url: 'https://media.giphy.com/media/l4q8cJzGdR9J8w3hS/giphy.gif', previewUrl: 'https://media.giphy.com/media/l4q8cJzGdR9J8w3hS/200w.gif' },
  { id: '7', title: 'Popcorn Excited', url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif', previewUrl: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif' },
  { id: '8', title: 'Laughing Dog', url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', previewUrl: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/200w.gif' },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').toLowerCase().trim();

  if (!query) {
    return NextResponse.json({ gifs: CURATED_GIFS });
  }

  const filtered = CURATED_GIFS.filter((g) => g.title.toLowerCase().includes(query));
  return NextResponse.json({ gifs: filtered.length ? filtered : CURATED_GIFS.slice(0, 4) });
}
