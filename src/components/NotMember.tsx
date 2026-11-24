import SignOut from "./SignOut";

export default function NotMember() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted max-w-xs">This account isn&apos;t on the inbox list. Only Grant and Tracy can use it.</p>
      <SignOut />
    </main>
  );
}
