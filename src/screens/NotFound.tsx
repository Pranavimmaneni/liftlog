import { Link } from 'react-router';
import { LinkButton } from '@/components/Button';
import { useDesign } from '@/app/design';
import { en } from '@/copy/en';

/** Rising Sun (FR-DSN-10, S26a): the message and the way home on a centred glass card. */
export function NotFoundSun() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5">
      <div className="sun-glass rounded-[18px] p-[18px] text-center">
        <h1 className="text-[17px] font-bold leading-snug">{en.errors.notFound}</h1>
        <LinkButton to="/" className="mt-4">
          {en.errors.goHome}
        </LinkButton>
      </div>
    </main>
  );
}

export default function NotFound() {
  const sun = useDesign() === 'sun';
  if (sun) return <NotFoundSun />;
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 px-5">
      <h1 className="t-display text-[34px]">{en.errors.notFound}</h1>
      <Link to="/" className="ll-link self-start">
        {en.errors.goHome}
      </Link>
    </main>
  );
}
