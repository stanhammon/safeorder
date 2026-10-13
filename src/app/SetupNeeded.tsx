export function SetupNeeded() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Almost there</h1>
      <p className="text-muted">SafeOrder can’t find its Supabase settings.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> in the project folder.
        </li>
        <li>Fill in your Supabase Project URL and anon/publishable key.</li>
        <li>
          Restart <code>npm run dev</code>.
        </li>
      </ol>
    </main>
  )
}
