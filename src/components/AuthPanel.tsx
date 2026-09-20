import Link from "next/link";

/**
 * The brand half of the sign-in and registration screens.
 *
 * It explains what the account is for, which matters here: the archive is a
 * public prototype, and a visitor arriving at a login form should be able to
 * tell straight away that they are meant to try it.
 */
export function AuthPanel() {
  return (
    <aside className="auth-brand">
      <div>
        <h2>The archive desk</h2>
        <p className="claim">Turn a CV into an archive, one checked record at a time.</p>
        <p className="note">
          An account gives you the archivist tools. Everything you publish is attributed to you, and
          every record keeps the line of CV text it came from.
        </p>
      </div>

      <ol className="auth-points">
        <li>
          <span className="n">01</span>
          <span>Paste unstructured CV text and let the extractor propose records.</span>
        </li>
        <li>
          <span className="n">02</span>
          <span>Correct anything wrong and drop what should not be kept.</span>
        </li>
        <li>
          <span className="n">03</span>
          <span>Publish under your name, or send it to the review queue.</span>
        </li>
      </ol>

      <p className="note" style={{ margin: 0 }}>
        Browsing needs no account — the{" "}
        <Link href="/">catalogue</Link> is open to everyone.
      </p>
    </aside>
  );
}
