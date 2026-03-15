import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/context/theme-context";
import { LogOut, User, Home, Menu, Sun, Moon, MessageCircle, Bell, Users } from "lucide-react";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { UnreadCountsContext } from "@/context/UnreadCountsContext";

// ── Badge component ──────────────────────────────────────────────────────────
function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Inner layout (needs to be inside AuthProvider to call useAuth) ────────────
function AppLayoutInner() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { token, username, logout, isAuthenticated } = useAuth();
  const { counts, refreshCounts } = useUnreadCounts(token);
  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <UnreadCountsContext.Provider value={{ refreshCounts }}>
    <div className="min-h-dvh flex flex-col">
      {/* ── Nav bar ── */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-4">
            <svg
              width="174mm" height="32mm"
              className="h-8 w-auto fill-[#00421c] dark:fill-[#517662] cursor-pointer"
              viewBox="0 0 174 32"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs id="defs1" />
              <g>
                <path d="m 12.348255,30.637608 c 2.976562,0 5.171777,-1.302246 6.895703,-3.001367 l -1.810742,-2.530078 c -1.376661,1.364258 -3.137793,2.38125 -5.18418,2.38125 -3.5842773,0 -7.0941406,-3.112988 -7.0941406,-7.14375 0,-4.005957 3.4602539,-7.180957 7.0817386,-7.180957 1.95957,0 3.782714,0.930176 5.184179,2.331641 l 1.823145,-2.468067 c -1.959571,-1.90996 -4.353223,-3.013769 -6.945313,-3.050976 -5.6182613,0 -10.3187495,4.725293 -10.3187495,10.355957 0,5.643066 4.7004882,10.306347 10.3683595,10.306347 z m 17.896582,0 c 5.692676,0 10.355957,-4.638476 10.355957,-10.293945 0,-5.705078 -4.663281,-10.368359 -10.343555,-10.368359 -5.692675,0 -10.331152,4.663281 -10.331152,10.368359 0,5.655469 4.638477,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.943945,0 -7.156152,-3.212207 -7.156152,-7.14375 0,-3.956347 3.212207,-7.180956 7.156152,-7.180956 3.943945,0 7.180957,3.224609 7.180957,7.180956 0,3.931543 -3.237012,7.14375 -7.180957,7.14375 z M 46.615931,27.189757 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z m 14.560353,0 V 10.32257 h -3.137793 v 19.992577 h 12.055078 v -3.12539 z M 84.505089,13.410753 V 10.32257 h -11.90625 v 19.992577 h 11.90625 v -3.12539 h -8.768457 v -5.531445 h 7.56543 v -3.125391 h -7.56543 v -5.122168 z m 12.675197,17.226855 c 2.976564,0 5.171774,-1.302246 6.895704,-3.001367 l -1.81074,-2.530078 c -1.37666,1.364258 -3.137796,2.38125 -5.184183,2.38125 -3.584277,0 -7.09414,-3.112988 -7.09414,-7.14375 0,-4.005957 3.460254,-7.180957 7.081738,-7.180957 1.95957,0 3.782715,0.930176 5.184175,2.331641 l 1.82315,-2.468067 c -1.95957,-1.90996 -4.353224,-3.013769 -6.945313,-3.050976 -5.618262,0 -10.31875,4.725293 -10.31875,10.355957 0,5.643066 4.700488,10.306347 10.368359,10.306347 z M 119.09523,10.32257 h -13.86582 v 3.112988 h 5.35781 v 16.879589 h 3.1502 V 13.435558 h 5.35781 z m 10.86445,20.315038 c 5.69267,0 10.35596,-4.638476 10.35596,-10.293945 0,-5.705078 -4.66329,-10.368359 -10.34356,-10.368359 -5.69267,0 -10.33115,4.663281 -10.33115,10.368359 0,5.655469 4.63848,10.293945 10.31875,10.293945 z m 0,-3.175 c -3.94395,0 -7.15615,-3.212207 -7.15615,-7.14375 0,-3.956347 3.2122,-7.180956 7.15615,-7.180956 3.94394,0 7.18096,3.224609 7.18096,7.180956 0,3.931543 -3.23702,7.14375 -7.18096,7.14375 z m 28.0789,2.852539 -5.8167,-7.999511 c 2.29444,-0.744141 3.95635,-2.988965 3.95635,-5.568652 0,-3.559473 -3.05097,-6.424414 -6.77168,-6.424414 h -6.21357 l 0.0124,19.992577 h 3.13779 v -7.739062 h 2.45567 l 5.38261,7.739062 z M 146.33077,19.971593 v -6.536035 h 3.1502 c 1.86035,0 3.46025,1.37666 3.46025,3.237011 0,1.785938 -1.5751,3.311426 -3.46025,3.299024 z m 16.58194,10.343554 h 3.11299 v -8.545214 l 6.63525,-11.447363 h -3.53466 l -4.66329,7.962304 -4.65087,-7.962304 h -3.53467 l 6.63525,11.447363 z" aria-label="collectory" />
                <path d="M 7.0138048,1.922205 H 1.9026999 V 3.0696892 H 3.8776528 V 9.2917051 H 5.0388519 V 3.0696892 h 1.9749529 z m 5.2619692,0 V 5.0309272 H 9.0847622 V 1.922205 H 7.9327064 V 9.2917051 H 9.0847622 V 6.1784114 h 3.1910118 v 3.1132937 h 1.156628 V 1.922205 Z m 6.962623,1.1383409 V 1.922205 h -4.388784 v 7.3695001 h 4.388784 V 8.1396493 H 16.00624 v -2.038956 h 2.788707 V 4.9486375 H 16.00624 V 3.0605459 Z" aria-label="the" />
              </g>
            </svg>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Messages icon + badge */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={() => navigate('/messages')}
                >
                  <MessageCircle className="h-4 w-4" />
                  <UnreadBadge count={counts.messages} />
                </Button>

                {/* Notifications icon + badge */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="h-4 w-4" />
                  <UnreadBadge count={counts.notifications} />
                </Button>

                {/* Hamburger menu */}
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </SheetTrigger>

                  <SheetContent side="right" className="w-72 flex flex-col">
                    <SheetHeader className="pb-4 border-b">
                      <SheetTitle className="text-left">Menu</SheetTitle>
                      {username && (
                        <p className="text-xs text-muted-foreground text-left">@{username}</p>
                      )}
                    </SheetHeader>

                    <nav className="mt-4 flex flex-col gap-1">
                      <button
                        onClick={() => go('/dashboard')}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <Home className="h-4 w-4" /> Dashboard
                      </button>

                      <button
                        onClick={() => go('/messages')}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Messages</span>
                        {counts.messages > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {counts.messages > 99 ? "99+" : counts.messages}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => go('/notifications')}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <Bell className="h-4 w-4" />
                        <span>Notifications</span>
                        {counts.notifications > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {counts.notifications > 99 ? "99+" : counts.notifications}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => go('/friends')}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <Users className="h-4 w-4" /> Friends
                      </button>

                      <button
                        onClick={() => go('/profile')}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <User className="h-4 w-4" /> Profile
                      </button>
                    </nav>

                    <div className="flex-1" />
                    <div className="border-t" />
                    <div className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 m-4">
                      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      <span className="text-sm text-muted-foreground">
                        {theme === "dark" ? "Dark mode" : "Light mode"}
                      </span>
                      <Switch
                        checked={theme === "dark"}
                        onCheckedChange={toggle}
                        aria-label="Toggle theme"
                        className="ml-auto"
                      />
                    </div>
                    <Button onClick={logout} className="flex items-center m-4">
                      <LogOut className="h-4 w-4" /> Logout
                    </Button>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Login</Button>
                <Button variant="default" size="sm" onClick={() => navigate('/signup')}>Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <main className="container mx-auto py-4 space-y-4 px-0 md:px-4">
        <div className="px-4 md:px-0">
          <Breadcrumbs />
        </div>
        <Outlet />
      </main>
    </div>
    </UnreadCountsContext.Provider>
  );
}

// Wrap in AuthProvider so useAuth works inside AppLayoutInner
export default function AppLayout() {
  return (
    <AuthProvider>
      <AppLayoutInner />
    </AuthProvider>
  );
}