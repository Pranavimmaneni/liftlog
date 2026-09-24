import { Link } from 'react-router';
import { en } from '@/copy/en';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 px-5">
      <h1 className="t-display text-[34px]">{en.errors.notFound}</h1>
      <Link to="/" className="ll-link self-start">
        {en.errors.goHome}
      </Link>
    </main>
  );
}
