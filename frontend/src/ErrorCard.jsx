import React from "react";
import Monogram from "./Monogram";
// Errors stay inside the invitation: useful next steps, no lost form state.
export default function ErrorCard({
  message,
  onRetry,
  title = "A little pause in the garden",
}) {
  if (!message) return null;
  return (
    <div className="garden-error" role="alert">
      <Monogram size={38} />
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="text-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function NotFound() {
  return (
    <main className="garden-not-found">
      <Monogram size={90} />
      <p className="eyebrow">A little detour</p>
      <h1>
        This little path
        <br />
        <i>leads nowhere.</i>
      </h1>
      <p>Your invitation is waiting just around the corner.</p>
      <a className="button dark" href="/">
        Back to the invitation
      </a>
    </main>
  );
}
export class InvitationBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="garden-not-found">
        <ErrorCard
          message="We couldn’t open this part of the invitation. Please reload to try again."
          onRetry={() => window.location.reload()}
        />
      </main>
    ) : (
      this.props.children
    );
  }
}
