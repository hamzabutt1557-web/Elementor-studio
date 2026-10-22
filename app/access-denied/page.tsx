import AccountMenu from "../account-menu";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <main className="auth-screen">
      <div className="auth-notice">
        <h1>Private workspace</h1>
        <p>
          This email does not have access. Sign out and use your approved email.
        </p>
        <AccountMenu />
      </div>
    </main>
  );
}
