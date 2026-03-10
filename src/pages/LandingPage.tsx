import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'

// ── Fonts: add to your index.html <head> ──────────────────────────────────────
// <link rel="preconnect" href="https://fonts.googleapis.com" />
// <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
// <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />

// ══════════════════════════════════════════════════════════════════════════════
// 🖼  IMAGE CONFIGURATION — edit these arrays to add/remove photos
// ══════════════════════════════════════════════════════════════════════════════
const HERO_IMAGES: string[] = [
  // '/images/hero-1.jpg',
  // '/images/hero-2.jpg',
  // '/images/hero-3.jpg',
]

const HOW_IT_WORKS_IMAGES: string[] = [
  // '/images/hiw-1.jpg',
  // '/images/hiw-2.jpg',
]

const SHOWCASE_IMAGES: string[] = [
  // '/images/showcase-1.jpg',
  // '/images/showcase-2.jpg',
]
// ══════════════════════════════════════════════════════════════════════════════

const SLIDE_DURATION = 10000  // ms each image is shown
const FADE_DURATION  = 1500   // ms crossfade transition

// ── Logo ──────────────────────────────────────────────────────────────────────
const LogoWordmark = ({ className }: { className?: string }) => (
  <svg width="174mm" height="32mm" viewBox="0 0 174 32" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="m 12.348255,30.637608 c 2.976562,0 5.171777,-1.302246 6.895703,-3.001367 l -1.810742,-2.530078 c -1.376661,1.364258 -3.137793,2.38125 -5.18418,2.38125 -3.5842773,0 -7.0941406,-3.112988 -7.0941406,-7.14375 0,-4.005957 3.4602539,-7.180957 7.0817386,-7.180957 1.95957,0 3.782714,0.930176 5.184179,2.331641 l 1.823145,-2.468067 c -1.959571,-1.90996 -4.353223,-3.013769 -6.945313,-3.050976 -5.6182613,0 -10.3187495,4.725293 -10.3187495,10.355957 0,5.643066 4.7004882,10.306347 10.3683595,10.306347 z m 17.896582,0 c 5.692676,0 10.355957,-4.638476 10.355957,-10.293945 0,-5.705078 -4.663281,-10.368359 -10.343555,-10.368359 -5.692675,0 -10.331152,4.663281 -10.331152,10.368359 0,5.655469 4.638477,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.943945,0 -7.156152,-3.212207 -7.156152,-7.14375 0,-3.956347 3.212207,-7.180956 7.156152,-7.180956 3.943945,0 7.180957,3.224609 7.180957,7.180956 0,3.931543 -3.237012,7.14375 -7.180957,7.14375 z M 46.615931,27.189757 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z m 14.560353,0 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z M 84.505089,13.410753 V 10.32257 h -11.90625 v 19.992577 h 11.90625 v -3.12539 h -8.768457 v -5.531445 h 7.56543 v -3.125391 h -7.56543 v -5.122168 z m 12.675197,17.226855 c 2.976564,0 5.171774,-1.302246 6.895704,-3.001367 l -1.81074,-2.530078 c -1.37666,1.364258 -3.137796,2.38125 -5.184183,2.38125 -3.584277,0 -7.09414,-3.112988 -7.09414,-7.14375 0,-4.005957 3.460254,-7.180957 7.081738,-7.180957 1.95957,0 3.782715,0.930176 5.184175,2.331641 l 1.82315,-2.468067 c -1.95957,-1.90996 -4.353224,-3.013769 -6.945313,-3.050976 -5.618262,0 -10.31875,4.725293 -10.31875,10.355957 0,5.643066 4.700488,10.306347 10.368359,10.306347 z M 119.09523,10.32257 h -13.86582 v 3.112988 h 5.35781 v 16.879589 h 3.1502 V 13.435558 h 5.35781 z m 10.86445,20.315038 c 5.69267,0 10.35596,-4.638476 10.35596,-10.293945 0,-5.705078 -4.66329,-10.368359 -10.34356,-10.368359 -5.69267,0 -10.33115,4.663281 -10.33115,10.368359 0,5.655469 4.63848,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.94395,0 -7.15615,-3.212207 -7.15615,-7.14375 0,-3.956347 3.2122,-7.180956 7.15615,-7.180956 3.94394,0 7.18096,3.224609 7.18096,7.180956 0,3.931543 -3.23702,7.14375 -7.18096,7.14375 z m 28.0789,2.852539 -5.8167,-7.999511 c 2.29444,-0.744141 3.95635,-2.988965 3.95635,-5.568652 0,-3.559473 -3.05097,-6.424414 -6.77168,-6.424414 h -6.21357 l 0.0124,19.992577 h 3.13779 v -7.739062 h 2.45567 l 5.38261,7.739062 z M 146.33077,19.971593 v -6.536035 h 3.1502 c 1.86035,0 3.46025,1.37666 3.46025,3.237011 0,1.785938 -1.5751,3.311426 -3.46025,3.299024 z m 16.58194,10.343554 h 3.11299 v -8.545214 l 6.63525,-11.447363 h -3.53466 l -4.66329,7.962304 -4.65087,-7.962304 h -3.53467 l 6.63525,11.447363 z" aria-label="collectory" />
      <path d="M 7.0138048,1.922205 H 1.9026999 V 3.0696892 H 3.8776528 V 9.2917051 H 5.0388519 V 3.0696892 h 1.9749529 z m 5.2619692,0 V 5.0309272 H 9.0847622 V 1.922205 H 7.9327064 V 9.2917051 H 9.0847622 V 6.1784114 h 3.1910118 v 3.1132937 h 1.156628 V 1.922205 Z m 6.962623,1.1383409 V 1.922205 h -4.388784 v 7.3695001 h 4.388784 V 8.1396493 H 16.00624 v -2.038956 h 2.788707 V 4.9486375 H 16.00624 V 3.0605459 Z" aria-label="the" />
    </g>
  </svg>
)

// ── Slideshow hook ────────────────────────────────────────────────────────────
// Returns the current and previous image index so we can crossfade between them.
function useSlideshow(images: string[]) {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev]       = useState<number | null>(null)
  const [fading, setFading]   = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (images.length <= 1) return
    timerRef.current = setTimeout(() => {
      setPrev(current)
      setFading(true)
      const next = (current + 1) % images.length
      // After fade completes, commit the new slide
      setTimeout(() => {
        setCurrent(next)
        setPrev(null)
        setFading(false)
      }, FADE_DURATION)
    }, SLIDE_DURATION)
    return () => clearTimeout(timerRef.current)
  }, [current, images.length])

  return { current, prev, fading, images }
}

// ── Slideshow background component ───────────────────────────────────────────
// Renders two stacked image layers; the top one fades out to reveal the next.
// Falls back to a plain div (no images shown) if the array is empty.
function SlideshowBg({
  images,
  overlay,
  className = '',
}: {
  images: string[]
  overlay: React.ReactNode   // gradient overlay passed as children
  className?: string
}) {
  const { current, prev, fading } = useSlideshow(images)
  const hasImages = images.length > 0

  return (
    <div className={`absolute inset-[-18%] ${className}`}>
      {hasImages ? (
        <>
          {/* Base layer — always the current image (or fallback colour) */}
          <div
            className="absolute inset-0 bg-center bg-cover transition-none"
            style={{ backgroundImage: `url('${images[current]}')`, backgroundColor: '#0d1a11' }}
          />
          {/* Outgoing layer — fades from opaque to transparent */}
          {prev !== null && (
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{
                backgroundImage: `url('${images[prev]}')`,
                backgroundColor: '#0d1a11',
                opacity: fading ? 0 : 1,
                transition: fading ? `opacity ${FADE_DURATION}ms ease-in-out` : 'none',
              }}
            />
          )}
        </>
      ) : (
        /* No images configured — render the original pure-CSS background */
        <div className="absolute inset-0" style={{ backgroundColor: '#0d1a11' }} />
      )}
      {/* Gradient overlay always sits on top to ensure text readability */}
      <div className="absolute inset-0">{overlay}</div>
    </div>
  )
}

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el    = entry.target as HTMLElement
            const delay = el.dataset.delay ?? '0'
            el.style.transitionDelay = `${delay}ms`
            el.classList.add('opacity-100', '!translate-y-0')
            el.classList.remove('opacity-0', 'translate-y-6')
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ── Parallax hook ─────────────────────────────────────────────────────────────
function useParallax() {
  useEffect(() => {
    const handler = () => {
      document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((bg) => {
        const section = bg.closest<HTMLElement>('[data-parallax-section]')
        if (!section) return
        const rect   = section.getBoundingClientRect()
        const speed  = parseFloat(bg.dataset.parallax ?? '0.4')
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed
        bg.style.transform = `translateY(${offset}px)`
      })
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [])
}

// ── Reveal wrapper ────────────────────────────────────────────────────────────
const Reveal = ({
  children, delay = 0, className = '',
}: {
  children: React.ReactNode; delay?: number; className?: string
}) => (
  <div
    data-reveal
    data-delay={delay}
    className={`opacity-0 translate-y-6 transition-all duration-700 ease-out ${className}`}
  >
    {children}
  </div>
)

// ── Feature data ──────────────────────────────────────────────────────────────
const features = [
  { num: '01', icon: '◈', title: 'Custom Collections', desc: 'Define your own fields — text, numbers, dropdowns, checkboxes, tags, images. Your catalog, your rules.' },
  { num: '02', icon: '◎', title: 'Smart Filtering',    desc: 'Fuzzy search and multi-field filters. Settings persist across sessions so your workflow is never interrupted.' },
  { num: '03', icon: '◉', title: 'Stats & Insights',   desc: 'Distribution charts, number analytics, date groupings. Understand your collection at a glance.' },
  { num: '04', icon: '○', title: 'Public Sharing',     desc: 'Share a link. Visitors get a beautiful read-only view — you keep complete control.' },
  { num: '05', icon: '◇', title: 'CSV Import',         desc: 'Bring your spreadsheet. Map columns, preview data, track progress. Migration in minutes.' },
  { num: '06', icon: '◈', title: 'Mobile Ready',       desc: 'Add items anywhere — at the store, the swap meet, on the road. Full mobile experience with swipe gestures.' },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useReveal()
  useParallax()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="font-body bg-cream text-ink overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-5 transition-all duration-500 ${
        scrolled
          ? 'bg-cream/90 backdrop-blur-md border-b border-green-deep/10'
          : 'bg-transparent border-b border-transparent'
      }`}>
        <Link to="/" className="flex items-center">
          <LogoWordmark className={`h-7 w-auto transition-all duration-500 ${scrolled ? 'fill-green-deep' : 'fill-white'}`} />
        </Link>
        <ul className="hidden md:flex gap-10 list-none">
          {['Features', 'Pricing', 'How it works'].map((label) => (
            <li key={label}>
              <a
                href={`#${label.toLowerCase().replace(' ', '-')}`}
                className={`text-xs font-normal tracking-widest uppercase transition-all duration-200 hover:opacity-100 ${
                  scrolled ? 'text-green-deep/60 hover:text-green-deep' : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <button
          onClick={() => navigate('/login')}
          className="text-xs font-medium tracking-widest uppercase text-ink bg-gold hover:bg-gold-light px-6 py-2.5 rounded-sm transition-all duration-200 hover:-translate-y-px"
        >
          Get started
        </button>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" data-parallax-section>

        <SlideshowBg
          images={HERO_IMAGES}
          overlay={
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 65% 40%, rgba(0,66,28,0.82) 0%, transparent 60%),
                  radial-gradient(ellipse at 15% 70%, rgba(81,118,98,0.4) 0%, transparent 55%),
                  linear-gradient(160deg, rgba(13,26,17,0.92) 0%, rgba(0,26,11,0.96) 100%)
                `,
              }}
            />
          }
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px' }}
        />
        {/* Left gold accent line */}
        <div
          className="absolute left-12 top-0 bottom-0 z-[2] w-px pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 10%, rgba(184,150,90,0.4) 40%, rgba(184,150,90,0.4) 60%, transparent 90%)' }}
        />

        {/* Content */}
        <div className="relative z-[3] max-w-4xl px-12 text-left w-full">
          <div className="flex items-center gap-4 mb-8 animate-[fadeSlide_0.8s_0.2s_both]">
            <div className="w-8 h-px bg-gold" />
            <span className="text-gold text-xs tracking-[0.2em] uppercase font-normal">Collection management platform</span>
          </div>
          <h1
            className="font-display font-light text-white leading-none tracking-tight mb-6 animate-[fadeSlide_0.9s_0.35s_both]"
            style={{ fontSize: 'clamp(3.5rem, 8vw, 8rem)' }}
          >
            The home for<br />
            <em className="not-italic text-green-light">every</em> collector
          </h1>
          <p
            className="font-display font-light italic text-white/50 tracking-wide mb-12 animate-[fadeSlide_0.9s_0.5s_both]"
            style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}
          >
            Every collection has a story. Tell yours.
          </p>
          <div className="flex gap-5 items-center flex-wrap animate-[fadeSlide_0.9s_0.65s_both]">
            <button
              onClick={() => navigate('/login')}
              className="bg-gold hover:bg-gold-light text-ink text-xs font-medium tracking-[0.12em] uppercase px-9 py-3.5 rounded-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(184,150,90,0.3)]"
            >
              Start cataloging
            </button>
            <a
              href="#how-it-works"
              className="text-white/45 hover:text-white/80 text-xs tracking-widest uppercase flex items-center gap-2 hover:gap-3 transition-all duration-200 after:content-['→']"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Corner label */}
        <span
          className="absolute bottom-12 right-12 z-[3] font-display text-xs tracking-[0.15em] text-white/20 uppercase animate-[fadeSlide_1s_0.9s_both]"
          style={{ writingMode: 'vertical-rl' }}
        >
          thecollectory.eu
        </span>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[3]">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent animate-[scrollDot_2s_ease-in-out_infinite]" />
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <div className="bg-green-deep flex items-center justify-between gap-12 px-12 py-14 flex-wrap">
        {[
          { num: 'Any', em: 'thing',   label: 'you collect' },
          { num: '',    em: 'Custom',  label: 'fields & filters' },
          { num: '',    em: 'Public',  label: 'sharing built-in' },
          { num: 'Free',em: '.',       label: 'to start today' },
        ].map((stat, i) => (
          <>
            {i > 0 && <div key={`div-${i}`} className="hidden sm:block w-px h-16 bg-white/15" />}
            <Reveal key={stat.label} delay={i * 100} className="text-center flex-1 min-w-[140px]">
              <div className="font-display font-light text-white leading-none mb-1.5" style={{ fontSize: '3rem' }}>
                {stat.num}<em className="not-italic text-gold">{stat.em}</em>
              </div>
              <div className="text-white/45 text-xs tracking-[0.15em] uppercase">{stat.label}</div>
            </Reveal>
          </>
        ))}
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-32 px-12 bg-cream">
        <div className="max-w-[1100px] mx-auto flex items-end justify-between gap-12 flex-wrap mb-20">
          <Reveal>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-px bg-gold" />
              <span className="text-gold text-xs tracking-[0.2em] uppercase">Platform features</span>
            </div>
            <h2 className="font-display font-light leading-tight" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}>
              Built for <em className="italic text-green-deep">serious</em><br />collectors
            </h2>
          </Reveal>
          <Reveal delay={100} className="max-w-sm">
            <p className="text-sm leading-loose font-light text-green-mid">
              No spreadsheet workarounds. No generic databases. A platform that fits the way you actually collect.
            </p>
          </Reveal>
        </div>
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-green-deep/10 border border-green-deep/10 rounded overflow-hidden">
          {features.map((f, i) => (
            <Reveal key={f.num} delay={i * 70}>
              <div className="bg-cream hover:bg-green-pale transition-colors duration-300 p-10 h-full">
                <div className="font-display text-gold text-xs tracking-widest mb-6">{f.num}</div>
                <h3 className="font-display font-normal text-ink leading-tight mb-3" style={{ fontSize: '1.3rem' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed font-light text-green-mid">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, #a8c5b0, transparent)' }} />

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-12 bg-cream-warm">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-px bg-gold" />
              <span className="text-gold text-xs tracking-[0.2em] uppercase">Pricing</span>
            </div>
            <h2 className="font-display font-light leading-tight mb-4" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}>
              Simple, <em className="italic text-green-deep">honest</em> pricing
            </h2>
            <p className="text-sm leading-loose font-light text-green-mid mb-16 max-w-sm">
              Start for free. Upgrade when your collection grows.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">

            {/* Free tier */}
            <Reveal delay={0}>
              <div className="flex flex-col h-full border border-green-deep/15 rounded bg-cream p-10">
                <div className="mb-8">
                  <h3 className="font-display font-normal text-ink text-2xl mb-1">Free</h3>
                  <div className="flex items-end gap-1 mt-3">
                    <span className="font-display font-light text-ink leading-none" style={{ fontSize: '3rem' }}>€0</span>
                    <span className="text-green-mid text-sm font-light mb-2">/ forever</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-3 mb-10 flex-1">
                  {[
                    '1 collection',
                    'Up to 500 items',
                    '1 photo per item',
                    'Limited analytics widgets',
                    'Friends & chat included',
                    'Public sharing',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm font-light text-green-mid">
                      <span className="text-green-deep mt-0.5 shrink-0">◎</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full cursor-pointer border border-green-deep text-green-deep text-xs font-medium tracking-[0.12em] uppercase py-3 rounded-sm hover:bg-green-deep hover:text-white transition-all duration-200"
                >
                  Get started free
                </button>
              </div>
            </Reveal>

            {/* Premium tier */}
            <Reveal delay={100}>
              <div className="flex flex-col h-full border border-green-deep rounded bg-green-deep p-10 relative overflow-hidden">
                {/* Subtle texture */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.04]"
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display font-normal text-white text-2xl mb-1">Premium</h3>
                  <span className="text-[10px] tracking-[0.15em] uppercase text-gold border border-gold/40 px-2.5 py-1 rounded-sm">
                      Best value
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mt-3 mb-1">
                    <span className="font-display font-light text-white leading-none" style={{ fontSize: '3rem' }}>€1.99</span>
                    <span className="text-white/50 text-sm font-light mb-2">/ month</span>
                  </div>
                  <p className="text-white/40 text-xs tracking-wide font-light mb-8">
                    or €17.91 / year — 3 months free
                  </p>
                  <ul className="flex flex-col gap-3 mb-10">
                    {[
                      'Unlimited collections',
                      'No item limit',
                      'Multiple photos per item',
                      'All analytics widgets',
                      'Friends & chat included',
                      'Public sharing',
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-3 text-sm font-light text-white/80">
                        <span className="text-gold mt-0.5 shrink-0">◈</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/signup')}
                    className="w-full cursor-pointer border border-green-deep text-green-deep text-xs font-medium tracking-[0.12em] uppercase py-3 rounded-sm hover:bg-green-deep hover:text-white transition-all duration-200"
                  >
                    Get started free
                  </button>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, #a8c5b0, transparent)' }} />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative min-h-[80vh] flex items-center overflow-hidden" data-parallax-section>

        <SlideshowBg
          images={HOW_IT_WORKS_IMAGES}
          overlay={
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 80% 20%, rgba(0,66,28,0.7) 0%, transparent 55%),
                  radial-gradient(ellipse at 5% 80%, rgba(81,118,98,0.25) 0%, transparent 50%),
                  linear-gradient(145deg, rgba(13,26,17,0.93) 0%, rgba(0,18,8,0.97) 100%)
                `,
              }}
            />
          }
        />

        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        <div className="relative z-[2] max-w-[1100px] mx-auto px-12 py-28 grid grid-cols-1 md:grid-cols-2 gap-28 items-center w-full">
          <div>
            <Reveal>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-6 h-px bg-gold" />
                <span className="text-gold text-xs tracking-[0.2em] uppercase">How it works</span>
              </div>
              <h2 className="font-display font-light text-white leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)' }}>
                Up and running<br />in <em className="italic text-green-light">minutes</em>
              </h2>
              <p className="text-sm font-light text-white/45 leading-loose mb-12">No configuration overhead. No manual to read.</p>
            </Reveal>
            <div className="flex flex-col divide-y divide-white/[0.07]">
              {[
                { n: '01', title: 'Create a collection', desc: 'Name it, give it an icon. Done in 10 seconds.' },
                { n: '02', title: 'Define your fields',  desc: 'Condition, year, value, photos — whatever matters to your hobby.' },
                { n: '03', title: 'Add your items',      desc: 'Type them in one by one, or bulk-import from a CSV.' },
                { n: '04', title: 'Browse, filter & share', desc: 'Your catalog, your stats, your story — shareable anytime.' },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 80}>
                  <div className="grid grid-cols-[2rem_1fr] gap-5 py-6">
                    <span className="font-display text-gold text-xs tracking-widest pt-0.5">{step.n}</span>
                    <div>
                      <strong className="block text-white text-sm font-medium mb-1">{step.title}</strong>
                      <span className="text-white/40 text-xs leading-relaxed font-light">{step.desc}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Visual placeholder */}
          <Reveal className="relative">
            <div
              className="w-full border border-white/10 rounded bg-white/[0.03] backdrop-blur-sm flex flex-col items-center justify-center gap-3"
              style={{ aspectRatio: '3/4' }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" opacity="0.15">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span className="text-white/20 text-xs tracking-widest uppercase">App screenshot</span>
            </div>
            {[
              'top-0 left-0',
              'top-0 right-0 rotate-90',
              'bottom-0 left-0 -rotate-90',
              'bottom-0 right-0 rotate-180',
            ].map((pos) => (
              <span key={pos} className={`absolute ${pos} w-3 h-3 pointer-events-none`}>
                <span className="absolute top-0 left-0 w-full h-px bg-gold/60" />
                <span className="absolute top-0 left-0 w-px h-full bg-gold/60" />
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── SHOWCASE / QUOTE ─────────────────────────────────────────────── */}
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden" data-parallax-section>

        <SlideshowBg
          images={SHOWCASE_IMAGES}
          overlay={
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse at 30% 60%, rgba(0,66,28,0.8) 0%, transparent 60%),
                  radial-gradient(ellipse at 75% 25%, rgba(81,118,98,0.3) 0%, transparent 50%),
                  linear-gradient(160deg, rgba(10,26,13,0.88) 0%, rgba(0,18,8,0.92) 100%)
                `,
              }}
            />
          }
        />

        <div className="relative z-[2] text-center px-12 py-24 max-w-3xl mx-auto">
          <Reveal>
            <blockquote
              className="font-display font-light italic text-white leading-tight tracking-tight"
              style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}
            >
              Every collection has a story.<br />
              <em className="not-italic text-green-light">Tell yours.</em>
            </blockquote>
          </Reveal>
          <Reveal delay={100}>
            <cite className="block mt-8 font-body not-italic text-white/30 text-xs tracking-[0.2em] uppercase">
              — thecollectory.eu
            </cite>
          </Reveal>
          <div className="grid grid-cols-3 gap-4 mt-16">
            {['Grid view', 'Item detail', 'Statistics'].map((label, i) => (
              <Reveal key={label} delay={i * 80}>
                <div
                  className="border border-white/10 rounded-sm bg-white/[0.04] flex items-center justify-center text-white/15 text-[10px] tracking-widest uppercase hover:border-gold/30 transition-colors duration-300"
                  style={{ aspectRatio: '16/10' }}
                >
                  {label}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section id="cta" className="py-36 px-12 bg-cream-warm">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto] gap-16 items-center">
          <div>
            <Reveal>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-px bg-gold" />
                <span className="text-gold text-xs tracking-[0.2em] uppercase">Free to start</span>
              </div>
              <h2 className="font-display font-light leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
                Ready to catalog<br />your <em className="italic text-green-deep">passion</em>?
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="mt-4 text-sm leading-loose font-light text-green-mid">
                No credit card. No complicated setup. Your first collection is minutes away.
              </p>
            </Reveal>
          </div>
          <Reveal delay={150} className="flex flex-col gap-4 items-start">
            <button
              onClick={() => navigate('/login')}
              className="bg-green-deep hover:bg-green-mid text-white text-xs font-medium tracking-[0.12em] uppercase px-10 py-4 rounded-sm whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,66,28,0.22)]"
            >
              Create your collection
            </button>
            <span className="text-xs text-green-mid/70 tracking-wide font-light">
              Free · No account required to browse
            </span>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-ink border-t border-gold/25 px-12 py-10 flex items-center justify-between flex-wrap gap-6">
        <LogoWordmark className="h-5 w-auto fill-white/40" />
        <p className="text-white/25 text-xs tracking-wide">© 2026 thecollectory.eu</p>
        <div className="flex gap-8">
          {['Privacy', 'Terms', 'Contact'].map((l) => (
            <a key={l} href="#" className="text-white/30 hover:text-gold text-xs tracking-widest uppercase transition-colors duration-200">{l}</a>
          ))}
        </div>
      </footer>

      {/* ── Global animations ────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollDot {
          0%   { transform: scaleY(0); transform-origin: top;    opacity: 0; }
          40%  { transform: scaleY(1); transform-origin: top;    opacity: 1; }
          60%  { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
          100% { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
        }
        [data-reveal] { will-change: opacity, transform; }
      `}</style>
    </div>
  )
}