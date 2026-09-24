import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { en } from '@/copy/en';

/** S05 Home. M0 shell; the real screen lands in M1. */
export default function Home() {
  const now = new Date();
  return (
    <div className="px-5 pt-[18px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-display text-[30px] tracking-[0.08em]">{en.app.name}</h1>
          <p className="t-label mt-1">
            {new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(now)}
          </p>
        </div>
        <Link to="/settings" className="ll-icon-btn" aria-label={en.common.settings}>
          <Icon name="gear" />
        </Link>
      </div>
    </div>
  );
}
