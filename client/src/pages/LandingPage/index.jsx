import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, KeyRound, MessageSquare, Activity, LockKeyhole, Sparkles } from 'lucide-react';

const features = [
  [ShieldCheck, 'Private by design', 'API credentials stay server-side. The client only handles authenticated application state.'],
  [KeyRound, 'Bring your own key', 'Connect supported model providers through a clear, masked key-management workflow.'],
  [MessageSquare, 'Project-based chat', 'Keep prompts, conversations, and model configuration organized by workspace.'],
  [Activity, 'Usage visibility', 'See consumption and limits without digging through raw API responses.'],
];

export default function LandingPage() {
  return <div className="app-shell min-h-screen">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">SB</span><span className="font-display text-sm font-bold">Secure Bridge</span></Link>
        <div className="flex items-center gap-2"><Link to="/login" className="btn-ghost">Sign in</Link><Link to="/register" className="btn-primary h-10">Get started <ArrowRight size={15}/></Link></div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="eyebrow flex items-center gap-2"><Sparkles size={13}/> Secure AI workspace</div>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-7xl">Your AI workspace.<br/><span className="text-primary">Your keys.</span><br/>Your control.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Secure Bridge is a project-based interface for using LLMs with your own provider credentials. The frontend never handles raw API keys.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/register" className="btn-primary">Create your workspace <ArrowRight size={16}/></Link><Link to="/login" className="btn-secondary">Sign in</Link></div>
          <div className="mt-10 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><LockKeyhole size={14} className="text-success"/> Server-side secrets</span><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-success"/> Authenticated sessions</span></div>
        </div>
        <div className="panel relative overflow-hidden p-5 sm:p-7">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl"/>
          <div className="relative rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between border-b border-border pb-4"><div><p className="eyebrow">Workspace</p><p className="mt-1 font-display text-lg font-semibold">Product Research</p></div><span className="rounded-full bg-success/10 px-2.5 py-1 font-mono text-[10px] text-success">ONLINE</span></div>
            <div className="space-y-3 py-5"><div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">Summarize the latest project notes.</div><div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">I can help. Your project context and conversation history are scoped to this workspace.</div></div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary p-2"><span className="flex-1 px-2 text-sm text-muted-foreground">Message your assistant…</span><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><ArrowRight size={15}/></span></div>
          </div>
        </div>
      </section>

      <section className="mt-28"><div className="mb-8 max-w-2xl"><p className="eyebrow">Built around the workflow</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Less friction. Better failure states. Clearer control.</h2></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(([Icon,title,desc])=><article key={title} className="panel p-5"><div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={19}/></div><h3 className="mt-5 font-display text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p></article>)}</div></section>
    </main>
    <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>Secure Bridge</span><span>Client-side rebuild · 2026</span></div></footer>
  </div>;
}
