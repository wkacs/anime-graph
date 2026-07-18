export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-3xl px-10 py-12 max-w-md text-center">
        <p className="label-mono mb-3">Hamarosan</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-text-2">{description}</p>
      </div>
    </main>
  )
}
