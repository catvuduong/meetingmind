import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state empty-state-page">
        <p className="empty-code">404</p>
        <p className="empty-title">Page not found</p>
        <p className="empty-text">The page you are looking for does not exist or has moved.</p>
        <div className="empty-action">
          <Link className="btn btn-primary" href="/">
            Go to the Analyse page
          </Link>
        </div>
      </div>
    </div>
  );
}
